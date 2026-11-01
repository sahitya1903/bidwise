import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminPanel from './pages/AdminPanel';
import AuctionDetail from './pages/AuctionDetail';
import AuctionList from './pages/AuctionList';
import CreateAuction from './pages/CreateAuction';
import Login from './pages/Login';
import MyBids from './pages/MyBids';
import MyListings from './pages/MyListings';
import Register from './pages/Register';

const guard = (el, role) => <ProtectedRoute role={role}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<AuctionList />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auctions/:id" element={<AuctionDetail />} />
          <Route path="/auctions/:id/edit" element={guard(<CreateAuction />)} />
          <Route path="/sell" element={guard(<CreateAuction />)} />
          <Route path="/me/bids" element={guard(<MyBids />)} />
          <Route path="/me/listings" element={guard(<MyListings />)} />
          <Route path="/admin" element={guard(<AdminPanel />, 'admin')} />
          <Route
            path="*"
            element={
              <div className="container page empty">
                <h1>Page not found</h1>
                <Link to="/" className="btn btn--primary">
                  Back to auctions
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">BidWise · Online Auction System · Software Engineering Project 32</div>
      </footer>
    </>
  );
}
