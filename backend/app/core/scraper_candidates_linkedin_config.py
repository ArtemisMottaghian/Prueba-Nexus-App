#Configuración de búsqueda para el scraper de candidatos en LinkedIn

SECTORS = {
    "SECTOR TECNOLÓGICO": "Tecnología OR Software OR IT OR Ciberseguridad",
    "SECTOR INGENIERÍA": "Ingeniería OR Engineering",
    "SECTOR FINANCIERO Y BANCA": "Finanzas OR Banca OR Banking",
    "SECTOR LEGAL": "Legal OR Abogado OR Jurídico",
    "SECTOR VENTAS": "Ventas OR Comercial OR Sales",
    "SECTOR LOGÍSTICA": "Logística OR Supply Chain OR Almacén",
    "SECTOR SERVICIOS": "Servicios OR Atención al cliente",
    "SECTOR SEGUROS": "Seguros OR Insurance"
}

LOCATIONS = [
    "España"   
]

HEADLESS_MODE = False # Si lo ponemos en True no abre navegador
MAX_PROFILES_PER_SEARCH = 5 # Cambiar aquí para añadir el numero de candidatos que queremos que nos saque por cada scrapeo
