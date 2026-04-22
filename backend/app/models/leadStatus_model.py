import enum

class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    in_progress = "in_progress"
    negotiating = "negotiating"
    discarded = "discarded"
    converted = "converted"