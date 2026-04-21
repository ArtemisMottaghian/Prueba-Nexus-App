import os
from dotenv import load_dotenv, find_dotenv

# 1. Buscamos y cargamos el archivo .env
load_dotenv(find_dotenv())

# 2. Extraemos tu clave de IA
GEMINI_API_KEY = os.getenv("GOOGLE_AI_KEY") 

# 3. Extraemos las credenciales de la BBDD directamente del .env

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),       
    "user": os.getenv("DB_USER"),        
    "password": os.getenv("DB_PASSWORD"), 
    "host": os.getenv("DB_HOST"), 
    "port": os.getenv("DB_PORT")       
}