import { api } from "./api";

export async function getCategories() {
  const { data } = await api.get("/categories");
  return data;
}

export async function getNudges() {
  const { data } = await api.get("/ai/nudges");
  return data.nudges || [];
}
