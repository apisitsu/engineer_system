import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import ControlPlanForm from './forms/ControlPlanForm';
import PFDForm from './forms/PFDForm';
import PFMEAForm from './forms/PFMEAForm';
import PIDForm from './forms/PIDForm';
import PDRForm from './forms/PDRForm';

const FORM_COMPONENTS = {
    control_plan: ControlPlanForm,
    pfd: PFDForm,
    pfmea: PFMEAForm,
    pid: PIDForm,
    pdr: PDRForm,
};

export default function TemplateFormEditor() {
    const { formType, formId } = useParams();
    const navigate = useNavigate();

    const FormComponent = FORM_COMPONENTS[formType];

    const handleBack = () => {
        navigate('/eng/template_tool');
    };

    if (!FormComponent) {
        return <div style={{ padding: 40, textAlign: 'center' }}>Form Type "{formType}" is invalid or not supported.</div>;
    }

    return (
        <FormComponent formId={formId} onBack={handleBack} />
    );
}
