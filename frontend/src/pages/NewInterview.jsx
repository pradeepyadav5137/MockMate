import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService, interviewService } from '../services/services';

const NewInterview = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('core_cs');
  const [selectedTier, setSelectedTier] = useState('free');
  const [notice, setNotice] = useState('1 free interview remaining today');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const interviewTypes = useMemo(() => [
    { id: 'core_cs', title: 'Core CS', desc: 'OS, DBMS, Networks, OOP, SQL', time: '~20-30 min' },
    { id: 'dsa', title: 'DSA', desc: 'Arrays, Trees, DP, Graphs', time: '~25-35 min' },
    { id: 'system_design', title: 'System Design', desc: 'HLD, LLD, Scalability', time: '~25-40 min' },
    { id: 'hr', title: 'HR', desc: 'Behavioral, Projects, Leadership', time: '~20 min' },
    { id: 'full_mix', title: 'Full Mix', desc: 'Resume + CS + DSA + System Design + HR. Best for placement prep', time: 'Pro only - 50 min' },
  ], []);

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    if (tier !== 'pro' && selectedType === 'full_mix') {
      setSelectedType('core_cs');
      setNotice('Full Mix requires Pro');
    } else {
      setNotice(tier === 'free' ? '1 free interview remaining today' : 'Payment required before starting');
    }
  };

  const createAndNavigate = async () => {
    const { data: interviewData } = await interviewService.create({ interviewType: selectedType, pricingTier: selectedTier });
    const { data: tokenData } = await interviewService.getToken(interviewData.interviewId);
    localStorage.setItem(`livekit_token_${interviewData.interviewId}`, tokenData.token);
    localStorage.setItem(`livekit_url_${interviewData.interviewId}`, tokenData.serverUrl || '');
    navigate(`/interview/${interviewData.interviewId}/room`);
  };

  const handlePaidStart = async () => {
    if (!window.Razorpay) throw new Error('Razorpay checkout script is not loaded');
    const { data: order } = await paymentService.createOrder({ type: 'interview', tier: selectedTier });
    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'MockMate',
        description: `${selectedTier.toUpperCase()} Interview`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await paymentService.verify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: 'interview',
              tier: selectedTier,
            });
            await createAndNavigate();
            resolve();
          } catch (err) { reject(err); }
        },
        modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        theme: { color: '#0d9488' },
      });
      rzp.open();
    });
  };

  const handleStart = async () => {
    try {
      setLoading(true);
      setError('');
      if (selectedTier !== 'free') await handlePaidStart();
      else await createAndNavigate();
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(message);
      if (message.includes('free interview')) setNotice('Free interview used today - upgrade to continue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Start New Interview</h1>
      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}
      {notice && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-6">{notice}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
        {interviewTypes.map((type) => {
          const isFullMix = type.id === 'full_mix';
          const isDisabled = isFullMix && selectedTier !== 'pro';
          return (
            <button
              type="button"
              key={type.id}
              onClick={() => !isDisabled && setSelectedType(type.id)}
              className={`p-4 sm:p-6 rounded-lg border-2 text-left transition-all min-h-40 ${selectedType === type.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'} ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer'} ${isFullMix ? 'col-span-2 lg:col-span-1' : ''}`}
              title={isDisabled ? 'Full Mix requires Pro' : ''}
              disabled={isDisabled}
            >
              <h3 className="text-lg sm:text-xl font-semibold mb-2 break-words">{type.title}</h3>
              <p className="text-gray-600 mb-3 text-sm sm:text-base break-words">{type.desc}</p>
              <span className="text-xs sm:text-sm font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full inline-block">{type.time}</span>
            </button>
          );
        })}
      </div>

      <h2 className="text-2xl font-bold mb-6 text-gray-800">Select Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10">
        {[{ id: 'free', title: 'Free', price: '₹0', time: '15 min' }, { id: 'basic', title: 'Basic', price: '₹9', time: '30 min' }, { id: 'pro', title: 'Pro', price: '₹19', time: '50 min' }].map((tier) => (
          <button type="button" key={tier.id} onClick={() => handleTierSelect(tier.id)} className={`p-6 rounded-lg border-2 text-center cursor-pointer ${selectedTier === tier.id ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'}`}>
            <h3 className="text-xl font-bold mb-2">{tier.title}</h3>
            <div className="text-3xl font-bold text-gray-800 mb-4">{tier.price}</div>
            <p className="text-gray-600 mb-4">{tier.time} duration</p>
            {tier.id === 'free' && <p className="text-sm text-gray-500">1 free interview remaining today</p>}
          </button>
        ))}
      </div>

      <div className="text-center">
        <button onClick={handleStart} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-10 rounded-full text-lg shadow-lg disabled:opacity-50">
          {loading ? 'Processing...' : 'Start Interview'}
        </button>
      </div>
    </div>
  );
};

export default NewInterview;
