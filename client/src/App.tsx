import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import KnowledgeBaseList from './pages/kb/KnowledgeBaseList';
import KnowledgeBaseDetail from './pages/kb/KnowledgeBaseDetail';
import Governance from './pages/Governance';
import ModelTraining from './pages/ModelTraining';
import TrainingList from './pages/training/TrainingList';
import TrainingDetail from './pages/training/TrainingDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kb" element={<KnowledgeBaseList />} />
          <Route path="/kb/:id" element={<KnowledgeBaseDetail />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/model-training" element={<ModelTraining />} />
          <Route path="/training" element={<TrainingList />} />
          <Route path="/training/:id" element={<TrainingDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
