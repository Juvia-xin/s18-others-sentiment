import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function fetchCompetitors() {
  const { data } = await api.get('/competitors');
  return data;
}

export async function seedCompetitors() {
  const { data } = await api.post('/competitors/seed');
  return data;
}

export async function fetchPosts({ competitor_id, platform, start_date, end_date, limit } = {}) {
  const { data } = await api.get('/posts', { params: { competitor_id, platform, start_date, end_date, limit } });
  return data;
}

export async function fetchSentimentSummary(competitor_id, date) {
  const { data } = await api.get('/sentiment/summary', { params: { competitor_id, date } });
  return data;
}

export async function fetchSentimentTrend(competitor_id, days = 7) {
  const { data } = await api.get('/sentiment/trend', { params: { competitor_id, days } });
  return data;
}

export async function fetchHotKeywords(competitor_id, date) {
  const { data } = await api.get('/sentiment/keywords', { params: { competitor_id, date } });
  return data;
}

export async function fetchDailyReports(date) {
  const { data } = await api.get('/reports', { params: { date } });
  return data;
}

export async function fetchReportOverview(date) {
  const { data } = await api.get('/reports/overview', { params: { date } });
  return data;
}

export async function fetchSentimentRanking(date) {
  const { data } = await api.get('/reports/ranking', { params: { date } });
  return data;
}

export async function fetchSamples(competitorId, date) {
  const { data } = await api.get(`/reports/${competitorId}/samples`, { params: { date } });
  return data;
}

export async function fetchArchives() {
  const { data } = await api.get('/reports/archives');
  return data;
}

export async function fetchLatestDate() {
  const { data } = await api.get('/reports/latest-date');
  return data;
}
