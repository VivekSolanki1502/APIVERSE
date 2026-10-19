import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';

const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const ApiDetail = lazy(() => import('./pages/ApiDetail'));
const BudgetFinder = lazy(() => import('./pages/BudgetFinder'));
const Compare = lazy(() => import('./pages/Compare'));
const Playground = lazy(() => import('./pages/Playground'));
const Collections = lazy(() => import('./pages/Collections'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Contribute = lazy(() => import('./pages/Contribute'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="api/:id" element={<ApiDetail />} />
          <Route path="budget-finder" element={<BudgetFinder />} />
          <Route path="compare" element={<Compare />} />
          <Route path="playground" element={<Playground />} />
          <Route path="collections" element={<Collections />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="contribute" element={<Contribute />} />
          <Route path="about" element={<About />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
