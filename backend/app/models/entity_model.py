import enum

class EntityType(str, enum.Enum):
    scraping_prospect = "scraping_prospect"
    confirmed_client = "confirmed_client"