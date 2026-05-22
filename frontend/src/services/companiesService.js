const getToken = () => localStorage.getItem('token');

export const getCompanyComments = async (companyId) => {
  const res = await fetch(`/api/companies/${companyId}/comments`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const addCompanyComment = async (companyId, body) => {
  const res = await fetch(`/api/companies/${companyId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

export const deleteCompanyComment = async (commentId) => {
  await fetch(`/api/companies/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
};
