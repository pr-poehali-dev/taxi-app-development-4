import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

const API_URL = 'https://functions.poehali.dev/77580903-218d-438c-b8c1-8515c9b83668';

type UserRole = 'passenger' | 'driver';
type OrderStatus = 'searching' | 'accepted' | 'arriving' | 'riding' | 'completed';

interface User {
  id: number;
  phone: string;
  name: string;
  role: UserRole;
  rating: number;
}

interface Marker {
  lat: number;
  lon: number;
}

interface Order {
  id: number;
  pickup: Marker;
  destination: Marker;
  tariff: string;
  status: OrderStatus;
  price?: number;
  passenger?: { name: string; phone: string; rating: number };
  driver?: { name: string; phone: string; rating: number; car: string; plate: string };
}

const tariffs = [
  { id: 'economy', name: 'Эконом', price: '250-300', icon: 'Car' },
  { id: 'comfort', name: 'Комфорт', price: '350-400', icon: 'Star' },
  { id: 'business', name: 'Бизнес', price: '500-600', icon: 'Crown' }
];

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | null>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('passenger');
  
  const [pickupMarker, setPickupMarker] = useState<Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<Marker | null>(null);
  const [selectedTariff, setSelectedTariff] = useState('economy');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [driverStatus, setDriverStatus] = useState<'offline' | 'online' | 'busy'>('offline');

  useEffect(() => {
    if (user?.role === 'driver' && driverStatus === 'online') {
      loadAvailableOrders();
      const interval = setInterval(loadAvailableOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [user, driverStatus]);

  useEffect(() => {
    if (currentOrder && user?.role === 'passenger') {
      const interval = setInterval(() => loadPassengerOrder(), 3000);
      return () => clearInterval(interval);
    }
  }, [currentOrder, user]);

  const handleAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/?action=auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, role: selectedRole })
      });
      const data = await response.json();
      setUser(data);
      setAuthMode(null);
      toast.success(`Добро пожаловать, ${data.name}!`);
    } catch (error) {
      toast.error('Ошибка авторизации');
    }
  };

  const loadAvailableOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/?action=orders&role=driver`);
      const orders = await response.json();
      setAvailableOrders(orders.filter((o: Order) => o.status === 'searching'));
    } catch (error) {
      console.error('Error loading orders', error);
    }
  };

  const loadPassengerOrder = async () => {
    try {
      const response = await fetch(`${API_URL}/?action=orders&user_id=${user?.id}&role=passenger`);
      const orders = await response.json();
      const active = orders.find((o: Order) => ['searching', 'accepted', 'arriving', 'riding'].includes(o.status));
      if (active) {
        setCurrentOrder(active);
        
        if (active.status === 'accepted' && currentOrder?.status === 'searching') {
          toast.success('Водитель найден!');
        } else if (active.status === 'arriving' && currentOrder?.status === 'accepted') {
          toast.info('Водитель прибыл на место посадки');
        } else if (active.status === 'riding' && currentOrder?.status === 'arriving') {
          toast.info('Поездка началась');
        } else if (active.status === 'completed') {
          toast.success('Поездка завершена!');
          setTimeout(() => {
            setCurrentOrder(null);
            setPickupMarker(null);
            setDestinationMarker(null);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Error loading passenger order', error);
    }
  };

  const handleCreateOrder = async () => {
    if (!pickupMarker || !destinationMarker) {
      toast.error('Укажите точки на карте');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/?action=orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_id: user?.id,
          pickup_lat: pickupMarker.lat,
          pickup_lon: pickupMarker.lon,
          destination_lat: destinationMarker.lat,
          destination_lon: destinationMarker.lon,
          tariff: selectedTariff
        })
      });
      const order = await response.json();
      setCurrentOrder({ ...order, pickup: pickupMarker, destination: destinationMarker, tariff: selectedTariff, passenger: { name: user?.name || '', phone: user?.phone || '', rating: user?.rating || 5 } });
      toast.success('Заказ создан! Ищем водителя...');
    } catch (error) {
      toast.error('Ошибка создания заказа');
    }
  };

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await fetch(`${API_URL}/?action=update_order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, action: 'accept', driver_id: user?.id })
      });
      
      const order = availableOrders.find(o => o.id === orderId);
      if (order) {
        setCurrentOrder(order);
        setDriverStatus('busy');
        toast.success('Заказ принят!');
        setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      }
    } catch (error) {
      toast.error('Ошибка принятия заказа');
    }
  };

  const handleUpdateOrderStatus = async (action: string, price?: number) => {
    try {
      await fetch(`${API_URL}/?action=update_order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: currentOrder?.id, action, price })
      });
      
      if (action === 'complete') {
        toast.success('Поездка завершена!');
        setDriverStatus('online');
        setTimeout(() => {
          setCurrentOrder(null);
        }, 2000);
      } else if (action === 'arrive') {
        toast.info('Вы прибыли на место');
        setCurrentOrder(prev => prev ? { ...prev, status: 'arriving' } : null);
      } else if (action === 'start') {
        toast.info('Поездка началась');
        setCurrentOrder(prev => prev ? { ...prev, status: 'riding' } : null);
      }
    } catch (error) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    if (user?.role !== 'passenger' || currentOrder) return;

    if (!pickupMarker) {
      setPickupMarker({ lat, lon });
      toast.success('Точка посадки отмечена');
    } else if (!destinationMarker) {
      setDestinationMarker({ lat, lon });
      toast.success('Точка назначения отмечена');
    }
  };

  const toggleDriverStatus = async () => {
    const newStatus = driverStatus === 'offline' ? 'online' : 'offline';
    try {
      await fetch(`${API_URL}/?action=driver/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: user?.id, status: newStatus })
      });
      setDriverStatus(newStatus);
      toast.success(newStatus === 'online' ? 'Вы в сети' : 'Вы оффлайн');
    } catch (error) {
      toast.error('Ошибка изменения статуса');
    }
  };

  if (authMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-center mb-6">Такси GO</h1>
          
          <div className="space-y-4 mb-6">
            <Input
              placeholder="Номер телефона"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12"
            />
            <Input
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setSelectedRole('passenger')}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedRole === 'passenger' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Icon name="User" size={32} className="mx-auto mb-2" />
              <p className="font-semibold">Пассажир</p>
            </button>
            <button
              onClick={() => setSelectedRole('driver')}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedRole === 'driver' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Icon name="Car" size={32} className="mx-auto mb-2" />
              <p className="font-semibold">Водитель</p>
            </button>
          </div>

          <Button onClick={handleAuth} className="w-full h-12 text-base">
            Войти
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 relative">
        <iframe
          src="https://fantastic-game.ru/openprovincemap/"
          className="absolute inset-0 w-full h-full border-0"
          title="Карта"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            handleMapClick(55.7558 + (y / rect.height) * 0.1, 37.6173 + (x / rect.width) * 0.1);
          }}
        />

        <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start">
          <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                {user?.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{user?.name}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Icon name="Star" size={14} className="text-yellow-500 fill-yellow-500" />
                  <span>{user?.rating}</span>
                </div>
              </div>
            </div>
          </Card>

          {user?.role === 'driver' && (
            <Button
              onClick={toggleDriverStatus}
              variant={driverStatus === 'online' ? 'default' : 'outline'}
              className="shadow-lg"
            >
              <Icon name={driverStatus === 'online' ? 'ToggleRight' : 'ToggleLeft'} size={20} className="mr-2" />
              {driverStatus === 'online' ? 'В сети' : 'Оффлайн'}
            </Button>
          )}
        </div>

        {pickupMarker && (
          <div className="absolute top-24 left-4 z-20 animate-fade-in">
            <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <Icon name="MapPin" size={16} className="text-white" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Точка А</p>
                <p className="text-xs text-muted-foreground">{pickupMarker.lat.toFixed(4)}, {pickupMarker.lon.toFixed(4)}</p>
              </div>
            </Card>
          </div>
        )}

        {destinationMarker && (
          <div className="absolute top-40 left-4 z-20 animate-fade-in">
            <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                <Icon name="Navigation" size={16} className="text-white" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Точка Б</p>
                <p className="text-xs text-muted-foreground">{destinationMarker.lat.toFixed(4)}, {destinationMarker.lon.toFixed(4)}</p>
              </div>
            </Card>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 max-w-2xl mx-auto p-4 pointer-events-none">
          <div className="pointer-events-auto">
            {user?.role === 'passenger' && !currentOrder && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 animate-slide-up">
                <h2 className="text-xl font-bold mb-4">Заказать такси</h2>
                
                {!pickupMarker && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-900">
                      <Icon name="Info" size={16} className="inline mr-2" />
                      Нажмите на карту для выбора точки посадки
                    </p>
                  </div>
                )}

                {pickupMarker && !destinationMarker && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-orange-900">
                      <Icon name="Info" size={16} className="inline mr-2" />
                      Нажмите на карту для выбора точки назначения
                    </p>
                  </div>
                )}

                {pickupMarker && destinationMarker && (
                  <>
                    <div className="space-y-3 mb-4">
                      {tariffs.map((tariff) => (
                        <button
                          key={tariff.id}
                          onClick={() => setSelectedTariff(tariff.id)}
                          className={`w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                            selectedTariff === tariff.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                selectedTariff === tariff.id ? 'bg-primary text-white' : 'bg-muted'
                              }`}>
                                <Icon name={tariff.icon as any} size={20} />
                              </div>
                              <div className="text-left">
                                <p className="font-semibold">{tariff.name}</p>
                              </div>
                            </div>
                            <p className="font-bold text-lg">{tariff.price} ₽</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setPickupMarker(null);
                          setDestinationMarker(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Сбросить
                      </Button>
                      <Button onClick={handleCreateOrder} className="flex-1">
                        Вызвать такси
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            )}

            {user?.role === 'passenger' && currentOrder && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    {currentOrder.status === 'searching' && 'Ищем водителя...'}
                    {currentOrder.status === 'accepted' && 'Водитель найден'}
                    {currentOrder.status === 'arriving' && 'Водитель прибыл'}
                    {currentOrder.status === 'riding' && 'В пути'}
                    {currentOrder.status === 'completed' && 'Завершено'}
                  </h2>
                  <Badge className={
                    currentOrder.status === 'searching' ? 'bg-yellow-500' :
                    currentOrder.status === 'accepted' ? 'bg-blue-500' :
                    currentOrder.status === 'arriving' ? 'bg-purple-500' :
                    currentOrder.status === 'riding' ? 'bg-green-500' : 'bg-gray-500'
                  }>
                    {currentOrder.status}
                  </Badge>
                </div>

                {currentOrder.driver && (
                  <div className="bg-muted rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {currentOrder.driver.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{currentOrder.driver.name}</p>
                        <p className="text-sm text-muted-foreground">{currentOrder.driver.car}</p>
                        <p className="text-sm font-semibold">{currentOrder.driver.plate}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="Star" size={16} className="text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold">{currentOrder.driver.rating}</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentOrder.status === 'completed' && (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <Icon name="Check" size={32} className="text-white" />
                    </div>
                    <p className="text-2xl font-bold mb-1">{currentOrder.price} ₽</p>
                    <p className="text-muted-foreground">Спасибо за поездку!</p>
                  </div>
                )}
              </Card>
            )}

            {user?.role === 'driver' && !currentOrder && driverStatus === 'online' && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 max-h-96 overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Доступные заказы ({availableOrders.length})</h2>
                
                {availableOrders.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Нет доступных заказов</p>
                )}

                <div className="space-y-3">
                  {availableOrders.map((order) => (
                    <div key={order.id} className="bg-white border-2 border-border rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold">Заказ #{order.id}</p>
                          <p className="text-sm text-muted-foreground">{order.passenger?.name}</p>
                        </div>
                        <Badge>{order.tariff}</Badge>
                      </div>

                      <div className="space-y-2 mb-3 text-sm">
                        <div className="flex items-start gap-2">
                          <Icon name="MapPin" size={16} className="text-green-500 mt-0.5" />
                          <span>{order.pickup.lat.toFixed(4)}, {order.pickup.lon.toFixed(4)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Icon name="Navigation" size={16} className="text-red-500 mt-0.5" />
                          <span>{order.destination.lat.toFixed(4)}, {order.destination.lon.toFixed(4)}</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="w-full"
                      >
                        Принять заказ
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {user?.role === 'driver' && currentOrder && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Заказ #{currentOrder.id}</h2>
                  <Badge className="bg-blue-500">Активный</Badge>
                </div>

                <div className="bg-muted rounded-xl p-4 mb-4">
                  <p className="font-bold mb-2">Пассажир</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                      {currentOrder.passenger?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{currentOrder.passenger?.name}</p>
                      <p className="text-sm text-muted-foreground">{currentOrder.passenger?.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {currentOrder.status === 'accepted' && (
                    <Button
                      onClick={() => handleUpdateOrderStatus('arrive')}
                      className="w-full"
                    >
                      <Icon name="MapPin" size={20} className="mr-2" />
                      Я на месте
                    </Button>
                  )}
                  {currentOrder.status === 'arriving' && (
                    <Button
                      onClick={() => handleUpdateOrderStatus('start')}
                      className="w-full"
                    >
                      <Icon name="Play" size={20} className="mr-2" />
                      Начать поездку
                    </Button>
                  )}
                  {currentOrder.status === 'riding' && (
                    <Button
                      onClick={() => handleUpdateOrderStatus('complete', 380)}
                      className="w-full bg-green-500 hover:bg-green-600"
                    >
                      <Icon name="Check" size={20} className="mr-2" />
                      Завершить поездку
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
