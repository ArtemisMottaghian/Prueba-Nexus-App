import re
from urllib.parse import quote_plus

def build_linkedin_url(keyword, location, exp_levels, workplace_types, date_posted, sectors, start=0):
    exp_param = ",".join(exp_levels) if exp_levels else ""
    workplace_param = ",".join(workplace_types) if workplace_types else ""
    sectors_param = ",".join(sectors) if sectors else ""

    keyword_str = str(keyword)
    
    date_param = ""
    if date_posted == "24h":
        date_param = "r86400"
    elif date_posted == "14d":
        date_param = "r1209600"
    elif date_posted =="month":
        date_param = "r2592000"

    url = f"https://www.linkedin.com/jobs/search/?keywords={quote_plus(keyword_str)}&location={quote_plus(location)}&f_I={sectors_param}"

    if exp_param: url += f"&f_E={exp_param}"
    if workplace_param: url += f"&f_WT={workplace_param}"
    if date_param: url += f"&f_TPR={date_param}"
    if sectors_param: url += f"&f_I={sectors_param}"

    url += f"&sortBy=DD&start={start}"
    return url

def parse_salary(text):
    if not text or text == None:
        return None
    
    text_clean = text.lower().replace(" ", "").replace("€", "").replace("euros", "")
    
    match_k_float = re.search(r'(\d+)[\.,](\d)k', text_clean)
    if match_k_float: return f"{match_k_float.group(1)}{match_k_float.group(2)}00"
        
    match_k = re.search(r'(\d{2,3})k', text_clean)
    if match_k: return f"{int(match_k.group(1)) * 1000}"
        
    match_num = re.search(r'(\d{2,3})[\.,](\d{3})', text_clean)
    if match_num: return f"{match_num.group(1)}{match_num.group(2)}"
        
    match_plain = re.search(r'(\d{4,6})', text_clean)
    if match_plain: return match_plain.group(1)
        
    return text.strip()

def is_valid_sector(sector_text, allowed_sector_ids, sector_mapping):
    if not allowed_sector_ids:
        return True 
        
    for sid in allowed_sector_ids:
        if str(sid) in sector_mapping:
            allowed_names = sector_mapping[str(sid)]
            for name in allowed_names:
                if name.lower() in sector_text.lower():
                    return True
    return False