import React from 'react';
import { Button, Result } from 'antd';

class PdfHubErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("PDF Hub Error Boundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Result
                        status="error"
                        title="PDF Hub Editor Crashed"
                        subTitle={this.state.error?.message || "An unexpected error occurred in the PDF viewer."}
                        extra={[
                            <Button 
                                type="primary" 
                                key="console" 
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                }}
                            >
                                Try Again
                            </Button>,
                        ]}
                    />
                </div>
            );
        }

        return this.props.children;
    }
}

export default PdfHubErrorBoundary;
