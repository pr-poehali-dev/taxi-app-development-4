import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

type MapMode = 'select-pickup' | 'select-destination' | 'review' | 'waiting' | 'riding' | 'completed';
type TariffType = 'economy' | 'comfort' | 'business';

interface Marker {
  lat: number;
  lon: number;
  label: string;
}

const tariffs = [
  { id: 'economy', name: 'Эконом', price: '250-300', time: '3 мин', icon: 'Car' },
  { id: 'comfort', name: 'Комфорт', price: '350-400', time: '5 мін', icon: 'Star' },
  { id: 'business', name: 'Бизнес', price: '500-600', time: '7 мин', icon: 'Crown' }
];

export default function Index() {
  const [mode, setMode] = useState<MapMode>('select-pickup');
  const [selectedTariff, setSelectedTariff] = useState<TariffType>('economy');
  const [pickupMarker, setPickupMarker] = useState<Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<Marker | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [driverInfo] = useState({
    name: 'Иван Петров',
    rating: 4.9,
    car: 'Toyota Camry',
    plate: 'А123БВ777',
    arrivalTime: 3
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://fantastic-game.ru') return;
      
      if (event.data.type === 'mapClick') {
        const { lat, lon } = event.data;
        
        if (mode === 'select-pickup') {
          setPickupMarker({ lat, lon, label: 'Точка A' });
          toast.success('Точка посадки отмечена');
          setMode('select-destination');
        } else if (mode === 'select-destination') {
          setDestinationMarker({ lat, lon, label: 'Точка Б' });
          toast.success('Точка назначения отмечена');
          setMode('review');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mode]);

  const handleConfirmOrder = () => {
    setMode('waiting');
    toast.success('Водитель найден! Ожидайте прибытия');
    
    setTimeout(() => {
      toast.info('Водитель прибыл на место посадки');
    }, 3000);
  };

  const handleStartRide = () => {
    setMode('riding');
    toast.info('Поездка началась');
  };

  const handleCompleteRide = () => {
    setMode('completed');
    toast.success('Поездка завершена!');
    
    setTimeout(() => {
      setMode('select-pickup');
      setPickupMarker(null);
      setDestinationMarker(null);
    }, 3000);
  };

  const handleReset = () => {
    setPickupMarker(null);
    setDestinationMarker(null);
    setMode('select-pickup');
    toast.info('Метки сброшены. Укажите точку посадки');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src="https://fantastic-game.ru/openprovincemap/"
          className="absolute inset-0 w-full h-full border-0"
          title="Карта"
          allow="geolocation"
        />

        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          {mode === 'select-pickup' && (
            <Badge className="bg-primary text-white text-base px-6 py-2 shadow-lg animate-fade-in">
              <Icon name="MapPin" size={18} className="inline mr-2" />
              Нажмите на карту для точки посадки
            </Badge>
          )}
          {mode === 'select-destination' && (
            <Badge className="bg-destructive text-white text-base px-6 py-2 shadow-lg animate-fade-in">
              <Icon name="Navigation" size={18} className="inline mr-2" />
              Нажмите на карту для точки назначения
            </Badge>
          )}
        </div>

        {pickupMarker && (
          <div className="absolute top-20 left-4 z-20 animate-fade-in">
            <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
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
          <div className="absolute top-36 left-4 z-20 animate-fade-in">
            <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
                <Icon name="Navigation" size={16} className="text-white" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Точка Б</p>
                <p className="text-xs text-muted-foreground">{destinationMarker.lat.toFixed(4)}, {destinationMarker.lon.toFixed(4)}</p>
              </div>
            </Card>
          </div>
        )}

        {(pickupMarker || destinationMarker) && mode !== 'completed' && mode !== 'waiting' && mode !== 'riding' && (
          <div className="absolute top-4 right-4 z-20">
            <Button
              onClick={handleReset}
              variant="destructive"
              size="sm"
              className="shadow-lg"
            >
              <Icon name="X" size={16} className="mr-1" />
              Сбросить
            </Button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 max-w-md mx-auto p-4 pointer-events-none">
          <div className="pointer-events-auto space-y-3">
            {mode === 'review' && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 animate-slide-up">
                <h2 className="text-xl font-bold mb-4">Выберите тариф</h2>
                
                <div className="space-y-3 mb-4">
                  {tariffs.map((tariff) => (
                    <button
                      key={tariff.id}
                      onClick={() => setSelectedTariff(tariff.id as TariffType)}
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
                            <p className="text-sm text-muted-foreground">{tariff.time}</p>
                          </div>
                        </div>
                        <p className="font-bold text-lg">{tariff.price} ₽</p>
                      </div>
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={handleConfirmOrder}
                  className="w-full h-12 text-base font-semibold"
                >
                  Вызвать такси
                </Button>
              </Card>
            )}

            {mode === 'waiting' && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 animate-slide-up">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Водитель найден</h2>
                  <Badge className="bg-green-500 text-white">В пути</Badge>
                </div>

                <div className="flex items-start gap-4 p-4 bg-muted rounded-xl mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {driverInfo.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">{driverInfo.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="Star" size={16} className="text-yellow-500 fill-yellow-500" />
                      <span>{driverInfo.rating}</span>
                    </div>
                    <p className="text-sm mt-1">{driverInfo.car} • {driverInfo.plate}</p>
                  </div>
                </div>

                <div className="bg-primary/10 rounded-xl p-4 mb-4 animate-pulse-soft">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="Clock" size={20} className="text-primary" />
                      <span className="font-semibold">Прибудет через</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">{driverInfo.arrivalTime} мин</span>
                  </div>
                </div>

                <Button 
                  onClick={handleStartRide}
                  variant="outline"
                  className="w-full h-12"
                >
                  Водитель прибыл - начать поездку
                </Button>
              </Card>
            )}

            {mode === 'riding' && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 animate-slide-up">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">В пути</h2>
                  <Badge className="bg-blue-500 text-white">Едем</Badge>
                </div>

                <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl p-6 mb-4">
                  <p className="text-center text-sm text-muted-foreground mb-2">Примерное время в пути</p>
                  <p className="text-center text-4xl font-bold">12 мин</p>
                </div>

                <Button 
                  onClick={handleCompleteRide}
                  className="w-full h-12 text-base font-semibold"
                >
                  Завершить поездку
                </Button>
              </Card>
            )}

            {mode === 'completed' && (
              <Card className="p-6 shadow-xl backdrop-blur-sm bg-white/95 animate-slide-up text-center">
                <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Icon name="Check" size={40} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Спасибо!</h2>
                <p className="text-muted-foreground mb-6">Ваша поездка завершена</p>
                
                <div className="bg-muted rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">Стоимость</span>
                    <span className="font-bold text-xl">380 ₽</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Время в пути</span>
                    <span>12 мин</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">Оцените поездку</p>
                <div className="flex gap-2 justify-center mt-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="w-10 h-10 rounded-full hover:bg-muted transition-colors"
                    >
                      <Icon name="Star" size={24} className="text-yellow-500 mx-auto" />
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <nav className="bg-white/95 backdrop-blur-sm border-t border-border shadow-lg relative z-20">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <button className="flex flex-col items-center gap-1 px-6 py-2 text-primary">
            <Icon name="Home" size={24} />
            <span className="text-xs font-medium">Главная</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-6 py-2 text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="Clock" size={24} />
            <span className="text-xs font-medium">История</span>
          </button>
          <button className="flex flex-col items-center gap-1 px-6 py-2 text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="User" size={24} />
            <span className="text-xs font-medium">Профиль</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
