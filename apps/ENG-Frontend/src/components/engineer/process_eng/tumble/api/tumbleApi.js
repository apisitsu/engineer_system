import { httpClient } from '../../../../../utils/HttpClient';

const BASE_URL = '/api/tumble';

export const tumbleApi = {
  // --- Models ---
  getAllModels: async () => {
    const response = await httpClient.get(`${BASE_URL}/model`);
    return response.data;
  },
  getModelByOldCn: async (oldCn) => {
    const response = await httpClient.get(`${BASE_URL}/model/search`, {
      params: { old_cn: oldCn }
    });
    return response.data;
  },
  createModel: async (data) => {
    const response = await httpClient.post(`${BASE_URL}/model`, data);
    return response.data;
  },
  updateModel: async (id, data) => {
    const response = await httpClient.put(`${BASE_URL}/model/${id}`, data);
    return response.data;
  },
  deleteModel: async (id) => {
    const response = await httpClient.delete(`${BASE_URL}/model/${id}`);
    return response.data;
  },

  // --- Conditions ---
  getAllConditions: async () => {
    const response = await httpClient.get(`${BASE_URL}/condition`);
    return response.data;
  },
  getConditionByCode: async (code) => {
    // console.log(":: getConditionByCode ::", code);
    const response = await httpClient.get(`${BASE_URL}/condition/search`, {
      params: { condition_code: code }
    });
    return response.data;
  },
  createCondition: async (data) => {
    const response = await httpClient.post(`${BASE_URL}/condition`, data);
    return response.data;
  },
  updateCondition: async (id, data) => {
    const response = await httpClient.put(`${BASE_URL}/condition/${id}`, data);
    return response.data;
  },
  deleteCondition: async (id) => {
    const response = await httpClient.delete(`${BASE_URL}/condition/${id}`);
    return response.data;
  },

  // --- Condition Parts ---
  getAllConditionParts: async () => {
    const response = await httpClient.get(`${BASE_URL}/condition-part`);
    return response.data;
  },
  createConditionPart: async (data) => {
    const response = await httpClient.post(`${BASE_URL}/condition-part`, data);
    return response.data;
  },
  updateConditionPart: async (id, data) => {
    const response = await httpClient.put(`${BASE_URL}/condition-part/${id}`, data);
    return response.data;
  },
  deleteConditionPart: async (id) => {
    const response = await httpClient.delete(`${BASE_URL}/condition-part/${id}`);
    return response.data;
  },

  // --- MRP Data ---
  getMrpDataByLotNo: async (lotNo) => {
    // console.log(":: getMrpDataByLotNo ::", lotNo)
    const response = await httpClient.get(`${BASE_URL}/mrp/${lotNo}`);
    return response.data || response;
  }
};
