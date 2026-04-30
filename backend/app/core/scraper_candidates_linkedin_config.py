SECTORS = {
    #"SECTOR TECNOLÓGICO": "Tecnología OR Software OR IT OR Ciberseguridad",
    #"SECTOR INGENIERÍA": "Ingeniería OR Engineering",
    "SECTOR FINANCIERO Y BANCA": "Finanzas OR Banca OR Banking",
    #"SECTOR LEGAL": "Legal OR Abogado OR Jurídico",
    #"SECTOR VENTAS": "Ventas OR Comercial OR Sales",
    #"SECTOR LOGÍSTICA": "Logística OR Supply Chain OR Almacén",
    #"SECTOR SERVICIOS": "Servicios OR Atención al cliente",
    #"SECTOR SEGUROS": "Seguros OR Insurance"
}

# NUEVO: Palabras clave específicas por sector para afinar la búsqueda.
# Si dejas la lista vacía [], buscará el sector en general.
KEYWORDS_PER_SECTOR = {
    #"SECTOR TECNOLÓGICO": ["Python", "PostgreSQL", "Cloud"], 
    #"SECTOR INGENIERÍA": ["Industrial", "AutoCAD"],          
    "SECTOR FINANCIERO Y BANCA": ["Suasor"],
    #"SECTOR LEGAL": ["Compliance", "Corporate"],
    #"SECTOR VENTAS": ["B2B", "SaaS"],
    #"SECTOR LOGÍSTICA": [],
    #"SECTOR SERVICIOS": [],
    #"SECTOR SEGUROS": ["Siniestros"]
}

LOCATIONS = [
    "España"   
]

HEADLESS_MODE = False # Si lo ponemos en True no abre navegador (ideal para ver qué hace Playwright)
MAX_PROFILES_PER_SEARCH = 5