"""Separa en lineas la experiencia y la formacion de los candidatos ya guardados
(que estan todo seguido separado por comas) usando la IA, para que en la ficha
salgan por puntos. Los que ya tienen saltos de linea se dejan como estan.

Ejecutar desde la carpeta backend (con el venv y el .env):
    python -m app.scripts.separar_apartados_cv

Con --todos re-procesa todos los candidatos con datos, aunque parezcan ya separados:
    python -m app.scripts.separar_apartados_cv --todos
"""

import asyncio
import sys

from sqlalchemy import select

from app.db.connection import AsyncSessionLocal
from app.models.candidates_model import Candidate
from app.services.ai_service import separar_apartados_cv


def _necesita_separar(texto: str) -> bool:
    """Le hace falta IA si tiene contenido en una sola linea con comas."""
    t = (texto or "").strip()
    return bool(t) and "\n" not in t and "," in t


def _educacion_sin_limpiar(texto: str) -> bool:
    """La formacion debe quedar solo con el titulo: si alguna linea lleva
    comas o parentesis, probablemente aun arrastra universidad o fechas."""
    t = (texto or "").strip()
    return bool(t) and ("," in t or "(" in t)


async def separar(todos: bool = False):
    async with AsyncSessionLocal() as db:
        candidatos = (await db.execute(select(Candidate))).scalars().all()

        revisados = 0
        actualizados = 0

        for c in candidatos:
            exp = (c.experience or "").strip()
            edu = (c.education or "").strip()

            if todos:
                if not exp and not edu:
                    continue
            elif not _necesita_separar(exp) and not _educacion_sin_limpiar(edu):
                continue

            revisados += 1
            try:
                data = await separar_apartados_cv(exp, edu)
            except Exception as e:
                print(f"  - Error con candidato {c.id}: {e}")
                continue

            # Se acepta tambien vacio: significa que no habia nada valido
            nuevo_exp = (data.get("experience") or "").strip()
            nuevo_edu = (data.get("education") or "").strip()
            if nuevo_exp != exp or nuevo_edu != edu:
                c.experience = nuevo_exp
                c.education = nuevo_edu
                actualizados += 1
                print(f"  * Candidato {c.id} separado")

        await db.commit()
        print(f"Candidatos revisados: {revisados}")
        print(f"Candidatos actualizados: {actualizados}")


if __name__ == "__main__":
    asyncio.run(separar(todos="--todos" in sys.argv))
