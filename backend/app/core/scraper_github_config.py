# app/core/scraper_github_config.py

# Lenguajes o tecnologías que queremos buscar en GitHub
LENGUAJES_IT = [
    # --- LENGUAJES CORE (Backend & Scripting) ---
    "python",
    "java",
    "c#",
    "c++",
    "php",
    "ruby",
    "go",
    "rust",
    "scala",
    
    # --- FRONTEND & JAVASCRIPT ECOSISTEMA ---
    "javascript",
    "typescript",
    "react",
    "angular",
    "vue",
    "next.js",
    "svelte",
    "html",
    "css",
    "tailwind",
    
    # --- MOBILE APP DEV ---
    "kotlin",
    "swift",
    "flutter",
    "dart",
    "react-native",
    "objective-c",
    
    # --- DATOS, IA & MACHINE LEARNING ---
    "sql",
    "r",
    "jupyter-notebook",
    "tensorflow",
    "pytorch",
    "pandas",
    "hadoop",
    "spark",
    
    # --- DEVOPS, CLOUD & SISTEMAS ---
    "dockerfile", # En GitHub, Docker se suele buscar así o como "shell"
    "shell",
    "bash",
    "powershell",
    "terraform",
    "kubernetes",
    "ansible"
]

# Ciudades o ubicaciones para filtrar (siempre dentro de España)
LOCATIONS_GITHUB = [
   # Top Hubs Tecnológicos
    "madrid", "barcelona", "valencia", "sevilla", "malaga", "bilbao", "zaragoza", "alicante",
    
    # Resto de Andalucía
    "granada", "cordoba", "almeria", "cadiz", "huelva", "jaen", "jerez",
    
    # Resto de Cataluña
    "tarragona", "lleida", "girona", "sabadell", "terrassa", "hospitalet",
    
    # Resto de Comunidad Valenciana & Murcia
    "castellon", "elche", "murcia", "cartagena",
    
    # Norte (Galicia, Asturias, Cantabria, País Vasco, Navarra, La Rioja)
    "coruña", "vigo", "santiago de compostela", "lugo", "ourense", "pontevedra",
    "oviedo", "gijon", "santander", "vitoria", "san sebastian", "pamplona", "logroño",
    
    # Centro e Interior (CyL, C-LM, Extremadura, Aragón)
    "valladolid", "burgos", "salamanca", "leon", "zamora", "palencia", "avila", "segovia", "soria",
    "toledo", "albacete", "ciudad real", "cuenca", "guadalajara",
    "badajoz", "caceres", "merida",
    "huesca", "teruel",
    
    # Islas y Ciudades Autónomas
    "palma", "ibiza", "las palmas", "tenerife", "santa cruz", "ceuta", "melilla",
    
    # Barridos genéricos (El "Colador" final para los que no especificaron ciudad)
    "spain",
    "españa"
]