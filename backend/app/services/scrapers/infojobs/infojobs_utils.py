import re

def extract_salary(texto):
    """Extraer numeros para los salarios limpiando los textos"""
    numeros =re.findall(r'\d+', texto.replace('.', ''))
    return [int(n) for n in numeros] if numeros else []