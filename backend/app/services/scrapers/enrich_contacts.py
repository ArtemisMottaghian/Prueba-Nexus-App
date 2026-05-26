"""
Script: enrich_contacts.py
Propósito: Enriquecer contactos sin email usando Apollo API
Uso: python enrich_contacts.py [--limit N] [--dry-run]

Opciones:
  --limit N    Máximo de contactos a procesar (default: 100)
  --dry-run    Simula sin guardar en BD ni gastar créditos Apollo
"""

import asyncio
import argparse
import re
import os
import sys
from dotenv import load_dotenv

load_dotenv()

import aiohttp
import asyncpg

# ── Config ────────────────────────────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT     = int(os.getenv("DB_PORT", 5432))
DB_NAME     = os.getenv("DB_NAME", "nexus_db")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
APOLLO_KEY  = os.getenv("APOLLO_API_KEY", "")

APOLLO_SEARCH_URL = "https://api.apollo.io/v1/mixed_people/api_search"
APOLLO_MATCH_URL  = "https://api.apollo.io/v1/people/match"
APOLLO_HEADERS    = {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
    "x-api-key": APOLLO_KEY
}

# ── Apollo ────────────────────────────────────────────────────────────────────

def clean_domain(url: str) -> str | None:
    if not url:
        return None
    return re.sub(r"https?://(www\.)?", "", url).split("/")[0].strip() or None


async def apollo_match(session: aiohttp.ClientSession, first_name: str, last_name: str,
                       company_name: str, domain: str | None) -> dict | None:
    """Fase 2: revelar email de una persona concreta."""
    if not last_name or not last_name.strip():
        return None

    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "organization_name": company_name,
        "reveal_personal_emails": True,
    }
    if domain:
        payload["domain"] = domain

    try:
        async with session.post(APOLLO_MATCH_URL, headers=APOLLO_HEADERS,
                                json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                print(f"      [APOLLO MATCH {resp.status}] {company_name}")
                return None
            data = await resp.json()
            person = data.get("person") or {}
            if not person:
                return None

            email = person.get("email")
            if not email:
                personal = person.get("personal_emails", [])
                email = personal[0] if personal else None

            phones = person.get("phone_numbers", [])
            phone = phones[0].get("sanitized_number") if phones else None

            return {
                "email": email,
                "phone": phone,
                "linkedin_url": person.get("linkedin_url"),
                "job_title": person.get("title"),
            }
    except Exception as e:
        print(f"      [APOLLO MATCH ERROR] {e}")
        return None


async def apollo_search(session: aiohttp.ClientSession,
                        company_name: str, domain: str | None) -> dict | None:
    """Fase 1: buscar reclutador HR en una empresa cuando no tenemos nombre."""
    payload = {
        "person_titles": ["Recruiter", "HR", "Talent Acquisition",
                          "HR Manager", "Selección", "People"],
        "person_locations": ["Spain"],
        "per_page": 1,
    }
    if domain:
        payload["q_organization_domains"] = domain
    else:
        payload["q_organization_name"] = company_name

    try:
        async with session.post(APOLLO_SEARCH_URL, headers=APOLLO_HEADERS,
                                json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                print(f"      [APOLLO SEARCH {resp.status}] {company_name}")
                return None
            data = await resp.json()
            people = data.get("people", [])
            if not people:
                return None
            p = people[0]
            return {
                "first_name": p.get("first_name", "") or "",
                "last_name":  p.get("last_name", "") or "",
                "linkedin_url": p.get("linkedin_url"),
                "job_title": p.get("title"),
            }
    except Exception as e:
        print(f"      [APOLLO SEARCH ERROR] {e}")
        return None


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(limit: int, dry_run: bool):
    if not APOLLO_KEY:
        print("[ERROR] APOLLO_API_KEY no encontrada en .env")
        sys.exit(1)

    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Conectando a BD {DB_NAME}@{DB_HOST}...")

    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )

    # Contactos sin email con empresa
    rows = await conn.fetch("""
        SELECT c.id, c.full_name, c.email, c.phone, c.linkedin_url, c.job_title,
               co.name AS company_name, co.website AS company_domain
        FROM contacts c
        JOIN companies co ON co.id = c.company_id
        WHERE (c.email IS NULL OR c.email = '')
        ORDER BY c.id
        LIMIT $1
    """, limit)

    total = len(rows)
    print(f"Contactos a procesar: {total}\n")

    enriquecidos = 0
    sin_email    = 0
    errores      = 0

    async with aiohttp.ClientSession() as session:
        for i, row in enumerate(rows, 1):
            contact_id   = row["id"]
            full_name    = row["full_name"] or ""
            company_name = row["company_name"] or ""
            domain       = clean_domain(row["company_domain"])

            print(f"[{i}/{total}] {full_name} — {company_name}")

            # Parsear nombre
            parts = full_name.strip().split(" ", 1)
            first_name = parts[0]
            last_name  = parts[1] if len(parts) > 1 else ""

            apollo_result = None

            # Si no tenemos apellido → buscar primero
            if not last_name or full_name.strip() == "HR Department":
                search = await apollo_search(session, company_name, domain)
                if search:
                    first_name = search["first_name"]
                    last_name  = search["last_name"]
                    print(f"      [SEARCH] Encontrado: {first_name} {last_name}")

            # Match para revelar email
            if last_name:
                apollo_result = await apollo_match(
                    session, first_name, last_name, company_name, domain
                )

            if apollo_result and apollo_result.get("email"):
                email     = apollo_result["email"]
                phone     = apollo_result.get("phone") or row["phone"]
                linkedin  = apollo_result.get("linkedin_url") or row["linkedin_url"]
                job_title = apollo_result.get("job_title") or row["job_title"]

                print(f"      [✅ EMAIL] {email}")
                enriquecidos += 1

                if not dry_run:
                    await conn.execute("""
                        UPDATE contacts
                        SET email = $1, phone = $2, linkedin_url = $3, job_title = $4
                        WHERE id = $5
                    """, email, phone, linkedin, job_title, contact_id)
            else:
                print(f"      [—] Sin email disponible")
                sin_email += 1

            # Pausa para no saturar Apollo
            await asyncio.sleep(0.3)

    await conn.close()

    print(f"\n{'='*50}")
    print(f"✅ Enriquecidos con email : {enriquecidos}")
    print(f"— Sin email disponible   : {sin_email}")
    print(f"❌ Errores               : {errores}")
    print(f"{'[DRY-RUN — nada guardado]' if dry_run else 'Guardado en BD ✅'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit",   type=int, default=100,
                        help="Máximo de contactos a procesar (default: 100)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Simula sin guardar ni gastar créditos")
    args = parser.parse_args()

    asyncio.run(main(args.limit, args.dry_run))