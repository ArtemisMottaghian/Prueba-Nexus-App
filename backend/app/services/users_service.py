from db.connection import get_db_connection


# ---------
# Crear usuarios
#---------
def crear_usuario(email, password_hash, rol):
    conexion = get_db_connection()
    cursor = conexion.cursor()

    try:
        query = """
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, %s)
            RETURNING id, email, role;
        """
        cursor.execute(query, (email, password_hash, rol))
        nuevo_usuario = cursor.fetchone()
       
       #confirmar cambios en db
        conexion.commit()

        # JSON
        return {
            "id": nuevo_usuario[0],
            "email": nuevo_usuario[1],
            "role": nuevo_usuario[2]
        }

    #Si hay error deshacemos cambios
    except Exception as e:
        conexion.rollback() 
        print(f"Error al crear usuario: {e}")
        return None
       
    finally:
        cursor.close()
        conexion.close()

# ---------
# obtener usuario por email
#---------
def obtener_usuario_email(email):
    conexion = get_db_connection()
    cursor = conexion.cursor()

    try:
        query = "SELECT id, email, role FROM users WHERE email = %s;"
        cursor.execute(query, (email,))
        usuario_db = cursor.fetchone()

        if not usuario_db:
            return None

        return {
            "id": usuario_db[0],
            "email": usuario_db[1],
            "role": usuario_db[2]
        }
    
    except Exception as e:
        print(f"Error al obtener usuario: {e}")
        return None
    
    finally:
        cursor.close()
        conexion.close()