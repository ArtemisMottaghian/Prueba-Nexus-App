import os
import sys

# Permite ejecutarlo directamente (añade la raíz 'backend/' al path de imports).
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
)

from app.core.reclutadoras import (
    es_empresa_reclutamiento,
    oferta_es_reclutadora,
    es_empresa_oculta,
)


# Empresas que SÍ deben descartarse.
RECLUTADORAS = [
    "Adecco", "Randstad España", "ManpowerGroup", "Hays", "Michael Page",
    "Grupo CRIT", "AraTalent", "Nortempo ETT", "GI Group", "Robert Walters",
    "Talento y Selección de Personal SL", "TechHunt Recruitment",
    "ABC Staffing Solutions", "Consultora de RRHH del Sur",
    "Empresa de Trabajo Temporal Levante", "Global Headhunters",
    "Talent Acquisition Partners", "Servicios de Outsourcing SA",
    "Grupo ETT", "Faster Empleo", "Reclutamiento Digital",
    "Interim Management Iberia", "Recursos Humanos Consulting",
]

# Empresas reales que NO deben descartarse (casos-trampa incluidos).
EMPRESAS_REALES = [
    "Banco Santander", "Inditex", "Telefónica", "Iberdrola", "Repsol",
    "Faraón S.L.",       # contiene 'aon'
    "Everett Software",  # contiene 'ett'
    "Mercerías López",   # contiene 'mercer...'
    "Grupo Antolin",     # parecido a 'antal'
    "Naturgy", "Mercadona", "NTT Data Spain", "Regional Group SL",
    "Playas de Cádiz SL", "Seat", "BBVA", "",
]

# Ofertas con empresa OCULTA: (company_name, titulo, descripcion, offer_url, esperado)
CASOS_OCULTA = [
    # Se delatan como agencia -> True (descartar)
    ("Empresa oculta", "Comercial", "En Randstad seleccionamos comerciales", "", True),
    ("Empresa confidencial", "Programador", "Buscamos para nuestro cliente del sector banca", "", True),
    ("Confidencial", "Enfermero/a", "", "https://www.hays.es/oferta/enfermero-123", True),
    ("Empresa oculta", "Mozo de almacén", "Seleccionamos para importante empresa del sector logístico", "", True),
    ("", "Analista", "En nombre de nuestro cliente buscamos analista", "", True),
    # Oculta pero SIN pistas de agencia -> False (mantener; puede ser un empleador real)
    ("Empresa confidencial", "Desarrollador Python", "Únete a nuestro equipo de producto. Teletrabajo y buen ambiente.", "", False),
    # Empresa REAL contratando un puesto de RRHH -> False (no confundir el rol con una agencia)
    ("Mercadona", "Técnico de Selección de Personal", "Buscamos técnico de recursos humanos para reclutamiento interno", "", False),
]


def test_reclutadoras_se_descartan():
    for nombre in RECLUTADORAS:
        assert es_empresa_reclutamiento(nombre) is True, f"Debería descartar: {nombre!r}"


def test_empresas_reales_no_se_descartan():
    for nombre in EMPRESAS_REALES:
        assert es_empresa_reclutamiento(nombre) is False, f"NO debería descartar: {nombre!r}"


def test_ofertas_con_empresa_oculta():
    for company, titulo, desc, url, esperado in CASOS_OCULTA:
        r = oferta_es_reclutadora(company, titulo, desc, url)
        assert r is esperado, f"{company!r} / {titulo!r} -> {r} (esperado {esperado})"


def test_deteccion_empresa_oculta():
    ocultas = ["Empresa oculta", "Empresa Oculta", "Empresa confidencial", "Confidencial", ""]
    for n in ocultas:
        assert es_empresa_oculta(n) is True, f"Debería ser oculta: {n!r}"
    visibles = ["Inditex", "Banco Santander", "Mercadona"]
    for n in visibles:
        assert es_empresa_oculta(n) is False, f"NO debería ser oculta: {n!r}"


if __name__ == "__main__":
    fallos = 0
    for nombre in RECLUTADORAS:
        if not es_empresa_reclutamiento(nombre):
            print(f"FALLO (debería descartar): {nombre!r}")
            fallos += 1
    for nombre in EMPRESAS_REALES:
        if es_empresa_reclutamiento(nombre):
            print(f"FALLO (no debería descartar): {nombre!r}")
            fallos += 1
    for company, titulo, desc, url, esperado in CASOS_OCULTA:
        r = oferta_es_reclutadora(company, titulo, desc, url)
        if r is not esperado:
            print(f"FALLO (oculta): {company!r} / {titulo!r} -> {r} (esperado {esperado})")
            fallos += 1
    total = len(RECLUTADORAS) + len(EMPRESAS_REALES) + len(CASOS_OCULTA)
    print(f"{total - fallos}/{total} OK" + (" ✅" if fallos == 0 else f"  ({fallos} fallos)"))
    sys.exit(1 if fallos else 0)
