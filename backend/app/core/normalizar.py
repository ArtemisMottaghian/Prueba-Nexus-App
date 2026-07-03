"""
Se evita la duplicación de empresas en la base de datos.

Dos nombres que solo se diferencian en tildes, mayúsculas, puntuación o el sufijo
legal (SL, SA, etc.) se consideran la MISMA empresa.

"""

import re
import unicodedata

# Sufijos societarios que se ignoran al comparar (como tokens completos).
_SUFIJOS = {
    "sl", "slu", "slp", "sa", "sau", "sc", "scp", "sccl", "scoop", "coop",
    "srl", "sas", "sl.", "ltd", "ltda", "inc", "llc", "gmbh", "bv", "ag",
    "plc", "cb", "ute",
}

def normalizar_empresa(nombre: str) -> str:
    """Devuelve una clave normalizada del nombre para comparar/deduplicar."""
    if not nombre:
        return ""
    # minúsculas + quitar tildes/acentos
    texto = unicodedata.normalize("NFD", str(nombre).lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    # ignorar los puntos de las abreviaturas (s.l. -> sl, s.a. -> sa)
    texto = texto.replace(".", "")
    # el resto de puntuación/caracteres especiales pasa a espacio
    texto = re.sub(r"[^a-z0-9 ]", " ", texto)
    # quitar sufijos societarios y espacios sobrantes
    tokens = [t for t in texto.split() if t and t not in _SUFIJOS]
    return " ".join(tokens)

def mismo_nombre_empresa(a: str, b: str) -> bool:
#True si dos nombres se refieren (probablemente) a la misma empresa.
    na, nb = normalizar_empresa(a), normalizar_empresa(b)
    return bool(na) and na == nb
