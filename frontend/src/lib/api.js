import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

export const listSamples = (module) =>
  api.get(`/${module}/samples`).then((r) => r.data);

export const createSample = (module, payload) =>
  api.post(`/${module}/samples`, payload).then((r) => r.data);

export const deleteSample = (module, id) =>
  api.delete(`/${module}/samples/${id}`).then((r) => r.data);

export const analyzeSample = (module, id) =>
  api.post(`/${module}/samples/${id}/analyze`).then((r) => r.data);
