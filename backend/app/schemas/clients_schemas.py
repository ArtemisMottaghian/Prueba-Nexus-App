from enum import Enum

class LeadStatus(str, Enum):
    new = "new"
    qualifying = "qualifying"
    negotiating = "negotiating"
    converted = "converted"
    lost = "lost"

class EntityType(str, Enum):
    scraping_prospect = "scraping_prospect"
    confirmed_client = "confirmed_client"