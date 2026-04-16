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
    "españa"
]