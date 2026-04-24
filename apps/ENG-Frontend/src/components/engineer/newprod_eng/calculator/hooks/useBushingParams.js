/**
 * useBushingParams - State management hook for bushing parameters.
 * Uses useReducer for predictable state transitions with validation.
 */
import { useReducer, useCallback } from 'react';
import { MODEL_TYPES, DEFAULT_PARAMS, DEFAULT_FLANGE_PARAMS, DEFAULT_SLEEVE_PARAMS, PARAM_LIMITS } from '../constants';
import { validateParams } from '../utils/calculations';

// Action types
const SET_PARAM = 'SET_PARAM';
const SET_MULTI = 'SET_MULTI';
const RESET_DEFAULTS = 'RESET_DEFAULTS';
const LOAD_CONFIG = 'LOAD_CONFIG';
const CHANGE_MODEL_TYPE = 'CHANGE_MODEL_TYPE';

function clampValue(value, paramKey) {
  const limits = PARAM_LIMITS[paramKey];
  if (!limits) return value;
  return Math.max(limits.min, Math.min(limits.max, value));
}

function reducer(state, action) {
  switch (action.type) {
    case CHANGE_MODEL_TYPE: {
      const type = action.payload;
      const initial = type === MODEL_TYPES.FLANGE ? DEFAULT_FLANGE_PARAMS 
                    : type === MODEL_TYPES.SLEEVE ? DEFAULT_SLEEVE_PARAMS 
                    : DEFAULT_PARAMS;
      return {
        ...state,
        params: { ...initial },
        validation: validateParams({ ...initial }),
        isDirty: false,
      };
    }
    case SET_PARAM: {
      const { key, value } = action.payload;
      const clampedValue = typeof value === 'number' ? clampValue(value, key) : value;
      const newParams = { ...state.params, [key]: clampedValue };
      const validation = validateParams(newParams);
      return {
        ...state,
        params: newParams,
        validation,
        isDirty: true,
      };
    }
    case SET_MULTI: {
      const newParams = { ...state.params, ...action.payload };
      Object.keys(action.payload).forEach(key => {
        if (typeof newParams[key] === 'number') {
          newParams[key] = clampValue(newParams[key], key);
        }
      });
      const validation = validateParams(newParams);
      return {
        ...state,
        params: newParams,
        validation,
        isDirty: true,
      };
    }
    case RESET_DEFAULTS: {
      const type = state.params.modelType;
      const initial = type === MODEL_TYPES.FLANGE ? DEFAULT_FLANGE_PARAMS 
                    : type === MODEL_TYPES.SLEEVE ? DEFAULT_SLEEVE_PARAMS 
                    : DEFAULT_PARAMS;
      return {
        ...state,
        params: { ...initial },
        validation: validateParams(initial),
        isDirty: false,
      };
    }
    case LOAD_CONFIG: {
      const type = action.payload.modelType;
      const base = type === MODEL_TYPES.FLANGE ? DEFAULT_FLANGE_PARAMS 
                 : type === MODEL_TYPES.SLEEVE ? DEFAULT_SLEEVE_PARAMS 
                 : DEFAULT_PARAMS;
      const loadedParams = { ...base, ...action.payload };
      return {
        ...state,
        params: loadedParams,
        validation: validateParams(loadedParams),
        isDirty: false,
      };
    }
    default:
      return state;
  }
}

export function useBushingParams() {
  const [state, dispatch] = useReducer(reducer, {
    params: { ...DEFAULT_PARAMS },
    validation: validateParams(DEFAULT_PARAMS),
    isDirty: false,
  });

  const setParam = useCallback((key, value) => {
    dispatch({ type: SET_PARAM, payload: { key, value } });
  }, []);

  const setMulti = useCallback((paramsObj) => {
    dispatch({ type: SET_MULTI, payload: paramsObj });
  }, []);

  const resetDefaults = useCallback(() => {
    dispatch({ type: RESET_DEFAULTS });
  }, []);

  const loadConfig = useCallback((configParams) => {
    dispatch({ type: LOAD_CONFIG, payload: configParams });
  }, []);

  const setModelType = useCallback((type) => {
    dispatch({ type: CHANGE_MODEL_TYPE, payload: type });
  }, []);

  return {
    params: state.params,
    validation: state.validation,
    isDirty: state.isDirty,
    setParam,
    setMulti,
    resetDefaults,
    loadConfig,
    setModelType,
  };
}

export default useBushingParams;
