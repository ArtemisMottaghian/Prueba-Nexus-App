#Configuración de búsqueda para el scraper de candidatos en LinkedIn

KEYWORDS = [
    "Tecnología",
    "Software", 
    "IT",
    "Ciberseguridad",
    #"Ingeniería",
    #"Engineering",
    #"Finanzas", 
    #"Banca",
    #"Banking",
    #"Legal", "Abogado", "Jurídico",
    #"Ventas", "Comercial", "Sales",
    #"Logística", "Supply Chain", "Almacén",
    #"Servicios", "Atención al cliente",
    #"Seguros", "Insurance"
    ]

SECTORS = {
    "Tecnología"
    #"Software",
    #"IT",
    #"Ciberseguridad",
    #"Ingeniería",
    #"Engineering",
    #"Finanzas",
    #"Banca",
    #"Banking",
    #"Legal",
    #"Abogado",
    #"Jurídico",
    #"Ventas",
    #"Comercial",
    #"Sales",
    #"Logística",
    #"Supply Chain",
    #"Almacén",
    #"Servicios",
    #"Atención al cliente",
    #"Seguros",
    #"Insurance"
}

LOCATIONS = [
    "Madrid", "Barcelona", "Salamanca", "Bilbao"   
]

HEADLESS_MODE = True # Si lo ponemos en True no abre navegador
MAX_PROFILES_PER_SEARCH = 5 # Cambiar aquí para añadir el numero de candidatos que queremos que nos saque por cada scrapeo