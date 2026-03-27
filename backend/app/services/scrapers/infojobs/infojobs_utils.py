import re

def extract_salary(text):
    """Extraer numeros para los salarios limpiando los textos"""
    if not text:
        return None
    text_clean = text.lower().replace("€", "").replace("euros", "")

    numeros = re.findall(r'\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b', text_clean)

    valores =  []
    for n in numeros:
        num_limpio = n.replace('.', '').split(',')[0]

        if num_limpio.isdigit() and len(num_limpio) >= 4:
            valores.append(int(num_limpio))

    return valores[:2] if valores else None        