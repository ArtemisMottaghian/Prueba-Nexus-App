import re
from urllib.parse import quote_plus


def build_linkedin_url(
    keyword: str,
    location: str,
    exp_levels: list[str] = None,
    workplace_types: list[str] = None,
    date_posted: str = None,
    sectors: list[str] = None,
    start: int = 0,
) -> str:
    """
    Construye la URL de búsqueda de empleos en LinkedIn basada en los filtros proporcionados.

    Args:
        keyword (str): Palabra clave del puesto (ej. "Python Developer").
        location (str): Ubicación de la búsqueda.
        exp_levels (list[str]): Niveles de experiencia permitidos.
        workplace_types (list[str]): Tipos de trabajo (Remoto, Presencial, etc.).
        date_posted (str): Filtro de fecha ("24h", "14d", "month").
        sectors (list[str]): IDs de los sectores en LinkedIn.
        start (int): Paginación (cada página suma 25).

    Returns:
        str: La URL completa y codificada lista para ser scrapeada.
    """

    exp_levels = exp_levels or []
    workplace_types = workplace_types or []
    sectors = sectors or []

    exp_param = ",".join(exp_levels)
    workplace_param = ",".join(workplace_types)
    sectors_param = ",".join(sectors)

    keyword_str = str(keyword)

    date_param = ""
    if date_posted == "24h":
        date_param = "r86400"
    elif date_posted == "14d":
        date_param = "r1209600"
    elif date_posted == "month":
        date_param = "r2592000"

    url = f"https://www.linkedin.com/jobs/search/?keywords={quote_plus(keyword_str)}&location={quote_plus(location)}"

    if exp_param:
        url += f"&f_E={exp_param}"
    if workplace_param:
        url += f"&f_WT={workplace_param}"
    if date_param:
        url += f"&f_TPR={date_param}"
    if sectors_param:
        url += f"&f_I={sectors_param}"

    url += f"&sortBy=DD&start={start}"
    return url


def parse_salary(text: str | None) -> int | None:
    """
    Extrae un valor numérico (entero) a partir de una cadena de texto de salario.

    Args:
        text (str | None): Texto crudo del salario (ej. "45.5k", "30.000 euros").

    Returns:
        int | None: El salario extraído como número, o None si no es válido.
    """

    if not text:
        return None

    text_clean = text.lower().replace(" ", "").replace("€", "").replace("euros", "")

    match_k_float = re.search(r"(\d+)[\.,](\d)k", text_clean)
    if match_k_float:
        return int(f"{match_k_float.group(1)}{match_k_float.group(2)}00")

    match_k = re.search(r"(\d{2,3})k", text_clean)
    if match_k:
        return int(match_k.group(1)) * 1000

    match_num = re.search(r"(\d{2,3})[\.,](\d{3})", text_clean)
    if match_num:
        return int(f"{match_num.group(1)}{match_num.group(2)}")

    match_plain = re.search(r"(\d{4,6})", text_clean)
    if match_plain:
        return int(match_plain.group(1))

    return None


def is_valid_sector(
    sector_text: str, allowed_sector_ids: list[str], sector_mapping: dict
) -> bool:
    """
    Valida si el texto del sector extraído coincide con los sectores permitidos de la búsqueda.

    Args:
        sector_text (str): El nombre del sector extraído de la oferta.
        allowed_sector_ids (list[str]): Los IDs de los sectores que estamos buscando.
        sector_mapping (dict): Diccionario que mapea IDs a posibles nombres de sector.

    Returns:
        bool: True si es válido o no hay filtros, False si no cumple los requisitos.
    """

    if not allowed_sector_ids:
        return True

    for sid in allowed_sector_ids:
        if str(sid) in sector_mapping:
            allowed_names = sector_mapping[str(sid)]
            if any(name.lower() in sector_text.lower() for name in allowed_names):
                return True
    return False
