import enum

class ApplicationStatus(str, enum.Enum):
    proposed = "proposed"
    client_interested = "client_interested"
    interviewing = "interviewing"
    offer_sent = "offer_sent"
    hired = "hired"
    rejected_by_client = "rejected_by_client"
    rejected_by_candidate = "rejected_by_candidate"
    pool = "pool"