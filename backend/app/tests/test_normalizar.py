import os
import sys

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
)

from app.core.normalizar import normalizar_empresa, mismo_nombre_empresa


# Cada grupo debe normalizar IGUAL (misma empresa escrita distinto)
EQUIVALENTES = [
    ["Faraón, S.L.", "FARAON SL", "Faraon", "faraón s.a."],
    ["Michael Page", "MICHAEL  PAGE", "michael page"],
    ["Grupo Éxito", "grupo exito"],
    ["Telefónica", "TELEFONICA", "telefonica s.a."],
]

# Pares que NO deben confundirse
DISTINTOS = [
    ("Inditex", "Zara"),
    ("Banco Santander", "Banco Sabadell"),
    ("Accenture", "Amazon"),
]


def test_equivalentes():
    for grupo in EQUIVALENTES:
        base = normalizar_empresa(grupo[0])
        for nombre in grupo[1:]:
            assert normalizar_empresa(nombre) == base, f"{nombre!r} != {grupo[0]!r}"
            assert mismo_nombre_empresa(grupo[0], nombre)


def test_distintos():
    for a, b in DISTINTOS:
        assert not mismo_nombre_empresa(a, b), f"{a!r} no debería igualar {b!r}"


if __name__ == "__main__":
    fallos = 0
    for grupo in EQUIVALENTES:
        base = normalizar_empresa(grupo[0])
        for nombre in grupo[1:]:
            if normalizar_empresa(nombre) != base:
                print(f"FALLO equiv: {nombre!r} -> {normalizar_empresa(nombre)!r} != {base!r}")
                fallos += 1
    for a, b in DISTINTOS:
        if mismo_nombre_empresa(a, b):
            print(f"FALLO distinto: {a!r} == {b!r}")
            fallos += 1
    total = sum(len(g) - 1 for g in EQUIVALENTES) + len(DISTINTOS)
    print(f"{total - fallos}/{total} OK" + (" ✅" if not fallos else f"  ({fallos} fallos)"))
    sys.exit(1 if fallos else 0)
