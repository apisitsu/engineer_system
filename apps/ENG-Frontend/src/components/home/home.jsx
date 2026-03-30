import React from "react";
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card, Row, Col, Layout } from 'antd';
import { useTheme } from '../../theme';

// Material-UI Icons (already installed)
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import FilePresentOutlinedIcon from '@mui/icons-material/FilePresentOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import DeveloperBoardOutlinedIcon from '@mui/icons-material/DeveloperBoardOutlined';
import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';

const { Content } = Layout;

const HomeEng = () => {
  const { theme } = useTheme();
  const { userDepartment, userRole } = useAuthStore();

  const hasRestrictedAccess = userDepartment === 'AD'
  // (userDepartment === 'ENG' && ['MGR', 'COORD'].includes(userRole));

  const styles = {
    box: {
      background: theme.colors.surface,
      boxShadow: theme.shadows.md,
      borderRadius: theme.borderRadius.lg,
      border: `1px solid ${theme.colors.border}`,
      transition: `all ${theme.transitions.normal}`,
    },
    header: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
      margin: 0,
      color: theme.colors.primary,
    },
    detail: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.sm,
    },
  };

  const modules = [
    {
      title: "New product Engineer",
      detail: "Process and quality design",
      icon: <DesignServicesOutlinedIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/newprod_eng",
      enabled: true
    },
    {
      title: "Materials Engineer",
      detail: "Document and special process",
      icon: <FilePresentOutlinedIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/materials_eng",
      enabled: false
    },
    {
      title: "Process Engineer",
      detail: "For process managements",
      icon: <AccountTreeOutlinedIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/process_eng",
      enabled: true
    },
    {
      title: "MTC Engineer",
      detail: "Tooling and program",
      icon: <ConstructionOutlinedIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/mtc_eng",
      enabled: true
    },
    {
      title: "Overall Engineer",
      detail: "For Engineer Information",
      icon: <DeveloperBoardOutlinedIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/overall_eng",
      enabled: true
    },
    {
      title: "System Engineer",
      detail: "For system managements",
      icon: <SettingsSystemDaydreamIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/system_eng",
      enabled: true,
      restricted: true
    },
    {
      title: "Kanban Board",
      detail: "Project & Task Management",
      icon: <ViewKanbanOutlinedIcon sx={{ fontSize: 48, color: theme.colors.primary, mb: 1.5 }} />,
      path: "/eng/kanban",
      enabled: true,
      restricted: true
    },
  ];

  return (
    <Content style={{
      padding: theme.spacing['2xl'],
      background: theme.colors.background,
      minHeight: '100vh'
    }}>
      <h1 style={{
        fontSize: theme.typography.fontSize['3xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.xl,
        textAlign: 'center'
      }}>
        Engineering Modules
      </h1>

      <Row gutter={[24, 24]} justify="center">
        {modules.map((module, index) => {
          // If module is restricted and user doesn't have access, don't render it
          if (module.restricted && !hasRestrictedAccess) {
            return null;
          }

          return (
            <Col key={index} xs={24} sm={12} md={8} lg={8}>
              {module.enabled ? (
                <Link to={module.path} style={{ textDecoration: 'none' }}>
                  <Card
                    hoverable
                    style={styles.box}
                    styles={{ body: { padding: theme.spacing.xl, textAlign: 'center' } }}
                  >
                    {module.icon}
                    <h2 style={styles.header}>{module.title}</h2>
                    <p style={styles.detail}>{module.detail}</p>
                  </Card>
                </Link>
              ) : (
                <Card
                  style={{
                    ...styles.box,
                    opacity: 0.6,
                    cursor: 'not-allowed'
                  }}
                  styles={{ body: { padding: theme.spacing.xl, textAlign: 'center' } }}
                >
                  {module.icon}
                  <h2 style={styles.header}>{module.title}</h2>
                  <p style={styles.detail}>{module.detail}</p>
                  <p style={{
                    color: theme.colors.textTertiary,
                    fontSize: theme.typography.fontSize.xs,
                    marginTop: theme.spacing.sm
                  }}>
                    Coming Soon
                  </p>
                </Card>
              )}
            </Col>
          );
        })}
      </Row>
    </Content>
  );
};

export default HomeEng;
