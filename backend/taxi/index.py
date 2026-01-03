import json
import os
import psycopg2
from datetime import datetime
from typing import Dict, Any

def handler(event: dict, context) -> dict:
    """API для управления заказами такси, пользователями и уведомлениями"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    query_params = event.get('queryStringParameters', {}) or {}
    action = query_params.get('action', '')
    path = f'/{action}' if action else '/'
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if path == '/auth' and method == 'POST':
            body = json.loads(event.get('body', '{}'))
            phone = body.get('phone')
            name = body.get('name')
            role = body.get('role', 'passenger')
            
            cur.execute(
                "SELECT id, phone, name, role, rating FROM users WHERE phone = %s",
                (phone,)
            )
            user = cur.fetchone()
            
            if user:
                result = {
                    'id': user[0],
                    'phone': user[1],
                    'name': user[2],
                    'role': user[3],
                    'rating': float(user[4])
                }
            else:
                cur.execute(
                    "INSERT INTO users (phone, name, role) VALUES (%s, %s, %s) RETURNING id, phone, name, role, rating",
                    (phone, name, role)
                )
                user = cur.fetchone()
                conn.commit()
                
                result = {
                    'id': user[0],
                    'phone': user[1],
                    'name': user[2],
                    'role': user[3],
                    'rating': float(user[4])
                }
                
                if role == 'driver':
                    cur.execute(
                        "INSERT INTO drivers (user_id, car_brand, car_model, car_color, license_plate, status) VALUES (%s, %s, %s, %s, %s, %s)",
                        (user[0], 'Toyota', 'Camry', 'Белый', 'А123БВ777', 'offline')
                    )
                    conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        elif path == '/orders' and method == 'POST':
            body = json.loads(event.get('body', '{}'))
            passenger_id = body.get('passenger_id')
            pickup_lat = body.get('pickup_lat')
            pickup_lon = body.get('pickup_lon')
            destination_lat = body.get('destination_lat')
            destination_lon = body.get('destination_lon')
            tariff = body.get('tariff', 'economy')
            
            cur.execute(
                "INSERT INTO orders (passenger_id, pickup_lat, pickup_lon, destination_lat, destination_lon, tariff, status) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, status, created_at",
                (passenger_id, pickup_lat, pickup_lon, destination_lat, destination_lon, tariff, 'searching')
            )
            order = cur.fetchone()
            conn.commit()
            
            cur.execute(
                "INSERT INTO notifications (user_id, order_id, title, message, type) SELECT id, %s, %s, %s, %s FROM users WHERE role = 'driver'",
                (order[0], 'Новый заказ!', f'Новый заказ #{order[0]} ожидает принятия', 'new_order')
            )
            conn.commit()
            
            result = {
                'id': order[0],
                'status': order[1],
                'created_at': order[2].isoformat()
            }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        elif path == '/orders' and method == 'GET':
            user_id = query_params.get('user_id')
            role = query_params.get('role')
            
            if role == 'driver':
                cur.execute(
                    """SELECT o.id, o.pickup_lat, o.pickup_lon, o.destination_lat, o.destination_lon, 
                       o.tariff, o.status, o.price, o.created_at, u.name, u.phone, u.rating
                       FROM orders o 
                       JOIN users u ON o.passenger_id = u.id 
                       WHERE o.status IN ('searching', 'accepted', 'arriving', 'riding') 
                       ORDER BY o.created_at DESC"""
                )
            else:
                cur.execute(
                    """SELECT o.id, o.pickup_lat, o.pickup_lon, o.destination_lat, o.destination_lon, 
                       o.tariff, o.status, o.price, o.created_at, u.name, u.phone, u.rating, d.car_brand, d.car_model, d.license_plate
                       FROM orders o 
                       LEFT JOIN users u ON o.driver_id = u.id 
                       LEFT JOIN drivers d ON u.id = d.user_id
                       WHERE o.passenger_id = %s 
                       ORDER BY o.created_at DESC LIMIT 10""",
                    (user_id,)
                )
            
            orders = cur.fetchall()
            result = []
            
            for order in orders:
                order_data = {
                    'id': order[0],
                    'pickup': {'lat': float(order[1]), 'lon': float(order[2])},
                    'destination': {'lat': float(order[3]), 'lon': float(order[4])},
                    'tariff': order[5],
                    'status': order[6],
                    'price': order[7],
                    'created_at': order[8].isoformat(),
                    'passenger': {'name': order[9], 'phone': order[10], 'rating': float(order[11])}
                }
                
                if role == 'passenger' and len(order) > 12:
                    if order[12]:
                        order_data['driver'] = {
                            'name': order[9],
                            'phone': order[10],
                            'rating': float(order[11]),
                            'car': f"{order[12]} {order[13]}",
                            'plate': order[14]
                        }
                
                result.append(order_data)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        elif path == '/update_order' and method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            order_id = body.get('order_id')
            action = body.get('action')
            driver_id = body.get('driver_id')
            
            if action == 'accept':
                cur.execute(
                    "UPDATE orders SET status = %s, driver_id = %s, accepted_at = %s WHERE id = %s RETURNING passenger_id",
                    ('accepted', driver_id, datetime.now(), order_id)
                )
                passenger = cur.fetchone()
                conn.commit()
                
                cur.execute(
                    "UPDATE drivers SET status = %s WHERE user_id = %s",
                    ('busy', driver_id)
                )
                conn.commit()
                
                cur.execute(
                    "SELECT name FROM users WHERE id = %s",
                    (driver_id,)
                )
                driver_name = cur.fetchone()[0]
                
                cur.execute(
                    "INSERT INTO notifications (user_id, order_id, title, message, type) VALUES (%s, %s, %s, %s, %s)",
                    (passenger[0], order_id, 'Водитель найден!', f'Водитель {driver_name} принял ваш заказ', 'driver_assigned')
                )
                conn.commit()
                
            elif action == 'arrive':
                cur.execute(
                    "UPDATE orders SET status = %s WHERE id = %s RETURNING passenger_id",
                    ('arriving', order_id)
                )
                passenger = cur.fetchone()
                conn.commit()
                
                cur.execute(
                    "INSERT INTO notifications (user_id, order_id, title, message, type) VALUES (%s, %s, %s, %s, %s)",
                    (passenger[0], order_id, 'Водитель прибыл', 'Водитель ожидает вас', 'driver_arrived')
                )
                conn.commit()
                
            elif action == 'start':
                cur.execute(
                    "UPDATE orders SET status = %s, started_at = %s WHERE id = %s",
                    ('riding', datetime.now(), order_id)
                )
                conn.commit()
                
            elif action == 'complete':
                cur.execute(
                    "UPDATE orders SET status = %s, completed_at = %s, price = %s WHERE id = %s RETURNING passenger_id, driver_id",
                    ('completed', datetime.now(), body.get('price', 380), order_id)
                )
                result = cur.fetchone()
                conn.commit()
                
                cur.execute(
                    "UPDATE drivers SET status = %s WHERE user_id = %s",
                    ('online', result[1])
                )
                conn.commit()
                
                cur.execute(
                    "INSERT INTO notifications (user_id, order_id, title, message, type) VALUES (%s, %s, %s, %s, %s)",
                    (result[0], order_id, 'Поездка завершена', 'Спасибо за использование нашего сервиса!', 'trip_completed')
                )
                conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        elif path == '/notifications' and method == 'GET':
            user_id = query_params.get('user_id')
            
            cur.execute(
                """SELECT id, order_id, title, message, type, is_read, created_at 
                   FROM notifications 
                   WHERE user_id = %s 
                   ORDER BY created_at DESC LIMIT 20""",
                (user_id,)
            )
            
            notifications = cur.fetchall()
            result = []
            
            for notif in notifications:
                result.append({
                    'id': notif[0],
                    'order_id': notif[1],
                    'title': notif[2],
                    'message': notif[3],
                    'type': notif[4],
                    'is_read': notif[5],
                    'created_at': notif[6].isoformat()
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        elif path == '/driver/status' and method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            driver_id = body.get('driver_id')
            status = body.get('status')
            
            cur.execute(
                "UPDATE drivers SET status = %s WHERE user_id = %s",
                (status, driver_id)
            )
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Not found'}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()