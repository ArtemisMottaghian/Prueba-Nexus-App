# Fichero creado para reunir aqui todas la clases de manera extensiva y mantener limpio el main
from app.db.connection import Base

from .aplication_model import ApplicationStatus
from .candidates_model import Candidate, CandidateStatus
from .contacts_model import Contact
from .entity_model import EntityType
from .job_model import JobPortal, JobOffer, JobApplication
from .leadStatus_model import LeadStatus
from .search_model import Search, SearchResult
from .trakingHistory_model import TrackingHistory
from .user_model import User
from .clients_model import Client
from .companies_model import Company, CompanyComment

