from enum import Enum
from pydantic import BaseModel, ConfigDict, EmailStr,Field, HttpUrl
from typing import Optional
from datetime import datetime
from pydantic import model_validator

class CandidateStatus(str, Enum):
    active = "active"
    passive = "passive"
    hired_elsewhere = "hired_elsewhere"
    blacklisted = "blacklisted"

# Esquema Base: Contiene los campos comunes que se repiten
class CandidateBase(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr # valida formato de correo
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-]{7,20}$')
    linkedin_url: Optional[HttpUrl] = None # Valida que sea una URL válida
    cv_url: Optional[HttpUrl] = None
    skills: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[CandidateStatus] = CandidateStatus.active


class CandidateCreate(CandidateBase):
    pass 

# Actualización 
class CandidateUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=2, max_length=50)
    last_name: Optional[str] = Field(None, min_length=2, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s\-]{7,20}$')  # Formato internacional de teléfono
    linkedin_url: Optional[HttpUrl] = None # Valida que sea una URL válida
    cv_url: Optional[HttpUrl] = None
    skills: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[CandidateStatus] = None

# Salida (CandidateOut / CandidateResponse)
class CandidateOut(CandidateBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)



class CandidateStatusOut(BaseModel):
    id: int
    status: CandidateStatus

    model_config = ConfigDict(from_attributes=True)

class CandidateFrontendOut(BaseModel):
    """
    Este es el esquema 'Traductor'.
    Convierte el modelo técnico de la DB al formato visual en el Front.
    """
    id: int
    name: str
    specialty: str
    location: str
    status: str
    source: str
    experience: Optional[str] = "Consultar CV"
    isAvailable: bool
    time: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def map_db_to_frontend(cls, data):
        """
        Este método se ejecuta ANTES de validar el esquema.
        Toma un objeto de la base de datos y lo 'maqueta' para el Frontend.
        """
        # Creamos el diccionario que espera el Frontend
        if hasattr(data, "id") and hasattr(data, "first_name"):
            return {
                "id": data.id,
                # Combinamos nombre y apellido en un solo campo 'name'
                "name": f"{data.first_name} {data.last_name}".strip(),
                # Si skills es None, devolvemos un texto amigable
                "specialty": getattr(data, "skills",None) or "Sin especificar",
                # Usamos location según lo tengamos en la base de datos
                "location":getattr(data, "city", "No indicada"),
                # Lógica de origen: Si viene del scraper tendrá un ID de origen
                "source": "Scraper InfoJobs" if getattr(data, "source_id", None) else "Carga Manual",
                "experience": getattr(data, "experience") or "Consultar CV",
                # Extraemos el valor del Enum (ej: "active")
                "status": data.status.value if hasattr(data.status, 'value') else str(data.status),
                # El Front usa un booleano para mostrar el check de disponibilidad
                "isAvailable": data.status in [CandidateStatus.active, CandidateStatus.passive],
                # Formateamos la fecha a algo legible (YYYY-MM-DD)
                "time": data.created_at.strftime("%Y-%m-%d") if getattr(data, "created_at", None) else "Reciente"

            }
        return data

class CandidateStatusUpdate(BaseModel):
    """Esquema específico para el endpoint PATCH"""
    status: CandidateStatus

class MessageResponse(BaseModel):
    message: str


if __name__ == "__main__":
    print("--- 🧪 TEST DE ESQUEMAS DE CANDIDATOS ---")


    # 1. Simulamos un objeto que vendría de SQLAlchemy (Base de Datos)
    class FakeCandidateModel:
        def __init__(self):
            self.id = 101
            self.first_name = "Alberto"
            self.last_name = "García"
            self.email = "alberto@ejemplo.com"
            self.skills = "Python, FastAPI, SQL"
            self.city = "Madrid"
            self.status = CandidateStatus.active
            self.source_id = 55  # Esto indica que viene del scraper
            self.experience = "3 años"
            self.created_at = datetime.now()


    objeto_db = FakeCandidateModel()

    # 2. PROBAMOS LA TRADUCCIÓN AL FRONTEND
    try:
        # Pydantic llamará a map_db_to_frontend automáticamente
        candidato_front = CandidateFrontendOut.model_validate(objeto_db)

        print("✅ TEST DE TRADUCCIÓN PASADO")
        print(f"   Nombre unido: {candidato_front.name}")
        print(f"   Origen detectado: {candidato_front.source}")
        print(f"   ¿Está disponible?: {candidato_front.isAvailable}")
        print(f"   Fecha formateada: {candidato_front.time}")

        # Mostramos el JSON final que recibiría Eder
        print("\n📦 JSON que recibirá el Frontend:")
        print(candidato_front.model_dump_json(indent=2))

    except Exception as e:
        print(f"❌ TEST FALLADO: {e}")

    # 3. TEST DE SEGURIDAD (URL inválida)
    print("\n--- 🧪 TEST DE SEGURIDAD ---")
    try:
        CandidateCreate(
            first_name="Test",
            last_name="Error",
            email="correo-mal-formado",  # Esto debería fallar
            linkedin_url="esto-no-es-una-url"
        )
        print("❌ Error: El sistema ha dejado pasar datos inválidos.")
    except Exception as e:
        print("✅ Validación de seguridad: PASADA (Bloqueó email y URL incorrectos)")