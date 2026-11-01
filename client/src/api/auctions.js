import api from './client';

export const listAuctions = (params) => api.get('/auctions', { params }).then((r) => r.data);
export const getAuction = (id) => api.get(`/auctions/${id}`).then((r) => r.data.auction);
export const createAuction = (data) => api.post('/auctions', data).then((r) => r.data.auction);
export const updateAuction = (id, data) => api.patch(`/auctions/${id}`, data).then((r) => r.data.auction);
export const cancelAuction = (id) => api.post(`/auctions/${id}/cancel`).then((r) => r.data.auction);
export const getBids = (id) => api.get(`/auctions/${id}/bids`).then((r) => r.data.bids);
export const placeBid = (id, amount) => api.post(`/auctions/${id}/bids`, { amount }).then((r) => r.data);
export const myBids = () => api.get('/me/bids').then((r) => r.data.items);
export const myListings = () => api.get('/me/auctions').then((r) => r.data.items);
