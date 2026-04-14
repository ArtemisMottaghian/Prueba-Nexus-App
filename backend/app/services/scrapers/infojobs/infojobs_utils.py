import re

def extract_salary(text: str | None) -> list[int] | None:
    """
    Extrae valores numéricos para los salarios limpiando el texto de entrada.
    Espera formatos como "24.000€" o "24.000 - 30.000 euros".

    Args:
        text (str | None): El texto crudo del salario a procesar.

    Returns:
        list[int] | None: Una lista con hasta dos números enteros representando el rango salarial,
                          o None si no se encuentran salarios válidos.
    """
    
    if not text:
        return None
    text_clean = text.lower().replace("€", "").replace("euros", "")

    numbers = re.findall(r'\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b', text_clean)

    values =  []
    for n in numbers:
        num_limpio = n.replace('.', '').split(',')[0]

        if num_limpio.isdigit() and len(num_limpio) >= 4:
            values.append(int(num_limpio))

    return values[:2] if values else None        
