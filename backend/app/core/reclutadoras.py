"""
Detección de empresas de reclutamiento. 

Sirve para descartar en el scraper las ofertas cuyo "empleador" es en realidad
una ETT/una consultora de RRHH/un competidor directo.

Se añaden nombres específicos de ETTs 

La coincidencia es por PALABRA COMPLETA (no por trozo suelto), para no descartar
por error a una empresa real. Ejemplos:
  - "aon"  detecta  "Aon"  y  "Grupo Aon" pero NO "Faraón S.L."
  - "ett"  detecta  "Grupo ETT" pero NO  "Everett Software"

"""

import re
import unicodedata


def _normalizar(texto: str) -> str:
    """minúsculas y sin acentos, para comparar de forma robusta."""
    if not texto:
        return ""
    texto = str(texto).lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto


# Nombres concretos de ETTs, consultoras de selección, headhunters y competencia.
EMPRESAS_BLACKLIST = [
    # Nosotros
    "aratalent", "aratech",
    # Grandes ETTs y consultoras de selección
    "adecco", "fundacion adecco", "randstad", "manpower", "manpowergroup",
    "hays", "page personnel", "michael page", "pagegroup", "robert walters",
    "walters people", "spring professional", "talent search people",
    "grupo crit", "crit interim", "grupo nortempo", "nortempo", "synergie",
    "eurofirms", "sibils consulting", "robert half", "experis",
    "antal international", "catenon", "bros group", "claire joster",
    "badenoch", "hudson", "oliver james", "frank recruitment", "nigel frank",
    "jefferson frank", "wyser", "jobandtalent", "kelly services", "gi group",
    "iman temporing", "temporing", "grupo ctc", "selectiva", "isgf", "ananda",
    "lhh", "korn ferry", "mercer", "cegos", "aon", "flexiplan",
    "faster empleo", "quales group", "hackajob",
    # Variantes sin espacios (para detectar por el dominio del enlace) 
    "michaelpage", "pagepersonnel", "roberthalf", "robertwalters",
    "walterspeople", "gigroup", "kellyservices", "grupocrit",
]

# Para identificar una empresa oculta en el portal
MARCADORES_OCULTA = [
    "empresa oculta",
    "empresa confidencial",
    "compania confidencial",
    "compania oculta",
    "confidencial",
    "empresa no divulgada",
    "empresa reservada",
    "nombre no divulgado",
    "hidden company",
    "company confidential",
]

# Para identificar si quien publica la vacante es un intermediario (ETT, consultora de selección, competidor directo)
SENALES_INTERMEDIARIO = [
    "nuestro cliente",
    "nuestra clienta",
    "para nuestro cliente",
    "en nombre de nuestro cliente",
    "importante cliente",
    "empresa cliente",
    "importante empresa del sector",
    "seleccionamos para",
    "reclutamos para",
    "consultora de seleccion",
    "firma de seleccion",
    "empresa de trabajo temporal",
]

# Se reconoce como empresa de reclutamiento si el nombre contiene alguna de estas palabras (como palabra completa, no alguna suelta).
PALABRAS_RECLUTAMIENTO = [
    "empresa de trabajo temporal",
    "trabajo temporal",
    "ett",
    "seleccion de personal",
    "seleccion de talento",
    "consultora de rrhh",
    "consultoria de rrhh",
    "consultora de recursos humanos",
    "consultoria de recursos humanos",
    "recursos humanos",
    "human resources",
    "reclutamiento",
    "recruitment",
    "recruiting",
    "recruiters",
    "staffing",
    "headhunting",
    "headhunter",
    "headhunters",
    "executive search",
    "outsourcing",
    "interim",
    "agencia de colocacion",
    "agencia de empleo",
    "bolsa de empleo",
    "talent acquisition",
    "talent solutions",
]


def _coincide(nombre_norm: str, patrones) -> bool:
#True si algún patrón aparece como palabra completa en el nombre.
    for p in patrones:
        p_norm = _normalizar(p)
        if not p_norm:
            continue
        # (?<![a-z0-9]) y (?![a-z0-9]) => límites de "palabra" (se exige que la palabra no sea un trozo de otra)
        if re.search(r"(?<![a-z0-9])" + re.escape(p_norm) + r"(?![a-z0-9])", nombre_norm):
            return True
    return False


def es_empresa_reclutamiento(nombre: str) -> bool:
#Devuelve True si el nombre parece de una ETT / consultora de RRHH/ competidor. Devuelve False si parece una empresa cliente real.
    if not nombre:
        return False
    n = _normalizar(nombre)
    if _coincide(n, EMPRESAS_BLACKLIST):
        return True
    if _coincide(n, PALABRAS_RECLUTAMIENTO):
        return True
    return False


def es_empresa_oculta(nombre: str) -> bool:
#True si el portal esconde la empresa ('empresa oculta/confidencial' o sin nombre)
    if not nombre:
        return True
    n = _normalizar(nombre)
    return any(m in n for m in MARCADORES_OCULTA)

def oferta_es_reclutadora(
    company_name: str = "",
    titulo: str = "",
    descripcion: str = "",
    offer_url: str = "",
) -> bool:
    """
    Por tanto, en el scraper, se descarta la oferta si:
      1) El nombre de la empresa es de una reclutadora conocida/genérica.
      2) El enlace de la oferta apunta a una agencia conocida (p. ej. randstad.es).
      3) La empresa está OCULTA y el texto (título/descripción/enlace) revela una 
      agencia conocida o pistas claras de intermediario ("nuestro cliente"...).
    """
    if es_empresa_reclutamiento(company_name):
        return True

    url_norm = _normalizar(offer_url)
    if url_norm and _coincide(url_norm, EMPRESAS_BLACKLIST):
        return True

    if es_empresa_oculta(company_name):
        texto = _normalizar(f"{titulo} {descripcion} {offer_url}")
        if _coincide(texto, EMPRESAS_BLACKLIST):
            return True
        if _coincide(texto, SENALES_INTERMEDIARIO):
            return True

    return False
