-- Создание таблиц для приложения такси

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('passenger', 'driver')),
    rating DECIMAL(3, 2) DEFAULT 5.00,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица данных водителей
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    car_brand VARCHAR(100) NOT NULL,
    car_model VARCHAR(100) NOT NULL,
    car_color VARCHAR(50) NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
    current_lat DECIMAL(10, 7),
    current_lon DECIMAL(10, 7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    passenger_id INTEGER NOT NULL REFERENCES users(id),
    driver_id INTEGER REFERENCES users(id),
    pickup_lat DECIMAL(10, 7) NOT NULL,
    pickup_lon DECIMAL(10, 7) NOT NULL,
    pickup_address TEXT,
    destination_lat DECIMAL(10, 7) NOT NULL,
    destination_lon DECIMAL(10, 7) NOT NULL,
    destination_address TEXT,
    tariff VARCHAR(20) NOT NULL CHECK (tariff IN ('economy', 'comfort', 'business')),
    price INTEGER,
    status VARCHAR(20) DEFAULT 'searching' CHECK (status IN ('searching', 'accepted', 'arriving', 'riding', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_passenger ON orders(passenger_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);