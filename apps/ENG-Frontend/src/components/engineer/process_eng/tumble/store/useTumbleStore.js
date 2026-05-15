import { create } from 'zustand';
import { tumbleApi } from '../api/tumbleApi';

export const useTumbleStore = create((set, get) => ({
  models: [],
  conditions: [],
  conditionParts: [],
  isLoading: false,
  error: null,

  // --- Fetch Methods ---
  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await tumbleApi.getAllModels();
      set({ models: response.data || response });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchConditions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await tumbleApi.getAllConditions();
      set({ conditions: response.data || response });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchConditionParts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await tumbleApi.getAllConditionParts();
      set({ conditionParts: response.data || response });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // --- Search Methods (For Production View) ---
  searchModelAndCondition: async (oldCn) => {
    set({ isLoading: true, error: null });
    try {
      const modelRes = await tumbleApi.getModelByOldCn(oldCn);
      if (!modelRes || (Array.isArray(modelRes.data) && modelRes.data.length === 0) || (Array.isArray(modelRes) && modelRes.length === 0)) {
        return { success: false, message: 'Model not found for this CN.' };
      }

      const models = modelRes.data || modelRes;

      return {
        success: true,
        models: models
      };
    } catch (error) {
      set({ error: error.message });
      return { success: false, message: 'Failed to fetch model/condition data' };
    } finally {
      set({ isLoading: false });
    }
  },

  getConditionByCode: async (code) => {
    set({ isLoading: true, error: null });
    try {
      // console.log(":: getConditionByCode ::", code);
      const condRes = await tumbleApi.getConditionByCode(code);
      return {
        success: true,
        conditions: condRes.data || condRes
      };
    } catch (error) {
      set({ error: error.message });
      return { success: false, message: 'Failed to fetch condition data' };
    } finally {
      set({ isLoading: false });
    }
  }
}));
