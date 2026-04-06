import enum

class LeadStatus(str, enum.Enum):
    new = "new"
    qualifying = "qualifying"
    negotiating = "negotiating"
    converted = "converted"
    lost = "lost"