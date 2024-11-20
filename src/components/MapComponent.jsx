// src/components/MapComponent.jsx

import React from 'react';
import { GoogleMap, Polyline, Marker, LoadScript } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '500px'
};

const MapComponent = ({ route }) => {
    const center = {
        lat: route.stops[0].lat,
        lng: route.stops[0].lng
    };

    const path = route.stops.map((stop) => ({
        lat: stop.lat,
        lng: stop.lng
    }));

    return (
        <LoadScript googleMapsApiKey="TU_CLAVE_API_DE_GOOGLE_MAPS">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={12}
            >
                {route.stops.map((stop, index) => (
                    <Marker key={index} position={{ lat: stop.lat, lng: stop.lng }} />
                ))}
                <Polyline
                    path={path}
                    options={{ strokeColor: '#FF0000' }}
                />
            </GoogleMap>
        </LoadScript>
    );
};

export default React.memo(MapComponent);
