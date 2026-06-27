import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import logoLuvan from '../assets/img/logo-sin-fondo.png';
import './LandingPage.css';

const WHATSAPP_NUMBER = '50237481552';

function PhoneIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.24 1z" fill="currentColor" />
        </svg>
    );
}

function ShieldIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function TimeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 9v4l3 2M9 2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function SupportIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 13a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="3" y="13" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <rect x="17" y="13" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 19a3 3 0 0 1-3 3h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function BusIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 11h18M8 4v7" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="7.5" cy="20" r="1.6" fill="currentColor" />
            <circle cx="16.5" cy="20" r="1.6" fill="currentColor" />
        </svg>
    );
}

function CorporateIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
        </svg>
    );
}

function CompassIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

function CalendarIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function EmailIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function WhatsAppOutlineIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4z" />
        </svg>
    );
}

function WhatsAppIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6.7 3.8c.38-.39.94-.52 1.45-.33l1.62.61c.47.18.8.6.84 1.1l.13 1.67c.03.42-.12.84-.42 1.14l-1.14 1.15c.66 1.28 1.42 2.42 2.3 3.41.93 1.04 2.02 1.89 3.26 2.56l1.14-1.14c.3-.3.72-.46 1.14-.42l1.67.13c.5.04.92.37 1.1.84l.61 1.62c.19.51.06 1.07-.33 1.45l-1.09 1.09c-.52.52-1.27.77-1.99.66-2.9-.44-5.48-1.91-7.75-4.42-2.25-2.49-3.57-5.09-3.98-7.8-.1-.71.14-1.44.66-1.96L6.7 3.8Z" fill="currentColor" />
            <path d="M14.72 4.75a5.12 5.12 0 0 1 4.53 4.53M14.55 7.47a2.48 2.48 0 0 1 1.98 1.98" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
        </svg>
    );
}

const LandingPage = () => {
    const rootRef = useRef(null);
    const [isSolidHeader, setIsSolidHeader] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.title = 'Transportes Luvan · Transporte escolar y empresarial seguro';
    }, []);

    useEffect(() => {
        const updateHeader = () => setIsSolidHeader(window.scrollY > 30);
        updateHeader();
        window.addEventListener('scroll', updateHeader, { passive: true });
        return () => window.removeEventListener('scroll', updateHeader);
    }, []);

    useEffect(() => {
        document.body.classList.toggle('luvan-menu-open', isMobileMenuOpen);
        return () => document.body.classList.remove('luvan-menu-open');
    }, [isMobileMenuOpen]);

    useEffect(() => {
        if (!isMobileMenuOpen) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') setIsMobileMenuOpen(false);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobileMenuOpen]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || typeof IntersectionObserver === 'undefined') return undefined;

        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry, index) => {
                    if (!entry.isIntersecting) return;
                    window.setTimeout(() => entry.target.classList.add('in'), index * 40);
                    revealObserver.unobserve(entry.target);
                });
            },
            { threshold: 0.16 }
        );

        const counterObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const counter = entry.target;
                    const target = Number(counter.dataset.to || 0);
                    const startedAt = performance.now();

                    const step = (time) => {
                        const progress = Math.min(1, (time - startedAt) / 1100);
                        counter.textContent = String(Math.round((1 - Math.pow(1 - progress, 3)) * target));
                        if (progress < 1) window.requestAnimationFrame(step);
                    };

                    window.requestAnimationFrame(step);
                    counterObserver.unobserve(counter);
                });
            },
            { threshold: 0.6 }
        );

        root.querySelectorAll('.luvan-reveal').forEach((element) => revealObserver.observe(element));
        root.querySelectorAll('.luvan-num').forEach((element) => counterObserver.observe(element));

        return () => {
            revealObserver.disconnect();
            counterObserver.disconnect();
        };
    }, []);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const handleContactSubmit = (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = String(form.get('name') || '').trim();
        const email = String(form.get('email') || '').trim();
        const subject = String(form.get('subject') || '').trim();
        const message = String(form.get('message') || '').trim();

        if (!name || !email || !subject || !message) return;

        const messageText = `Hola Transportes Luvan!\n\n*Nombre:* ${name}\n*Correo:* ${email}\n*Asunto:* ${subject}\n*Mensaje:* ${message}`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(messageText)}`, '_blank', 'noopener,noreferrer');
    };

    return (
        <main className="luvan-landing" ref={rootRef}>
            <header className={isSolidHeader ? 'luvan-header solid' : 'luvan-header'}>
                <div className="luvan-wrap luvan-nav">
                    <a href="#inicio" className="luvan-logo" aria-label="Transportes Luvan inicio">
                        <img src={logoLuvan} alt="Transportes Luvan" />
                    </a>

                    <nav className="luvan-navlinks" aria-label="Navegación principal">
                        <a href="#inicio">Inicio</a>
                        <a href="#servicios">Servicios</a>
                        <a href="#nosotros">Sobre Nosotros</a>
                        <a href="#contacto">Contacto</a>
                    </nav>

                    <div className="luvan-nav-actions">
                        <a href="tel:37481552" className="luvan-phone"><PhoneIcon />3748-1552</a>
                        <Link to="/login" className="luvan-btn luvan-btn-green">Iniciar Sesión</Link>
                        <button
                            className="luvan-menu-btn"
                            type="button"
                            onClick={() => setIsMobileMenuOpen((open) => !open)}
                            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                            aria-expanded={isMobileMenuOpen}
                        >
                            <span />
                            <span />
                            <span />
                        </button>
                    </div>
                </div>
            </header>

            <div className={isMobileMenuOpen ? 'luvan-mob-ov open' : 'luvan-mob-ov'} onClick={closeMobileMenu} aria-hidden="true" />
            <nav className={isMobileMenuOpen ? 'luvan-mobile open' : 'luvan-mobile'} aria-label="Navegación móvil">
                <div className="luvan-mobile-top">
                    <img src={logoLuvan} alt="Transportes Luvan" />
                    <button className="luvan-mobile-close" type="button" onClick={closeMobileMenu} aria-label="Cerrar menú">
                        <span />
                        <span />
                    </button>
                </div>
                <div className="luvan-mobile-links">
                    <a href="#inicio" onClick={closeMobileMenu}>Inicio</a>
                    <a href="#servicios" onClick={closeMobileMenu}>Servicios</a>
                    <a href="#nosotros" onClick={closeMobileMenu}>Sobre Nosotros</a>
                    <a href="#contacto" onClick={closeMobileMenu}>Contacto</a>
                    <Link to="/login" className="luvan-btn luvan-btn-green" onClick={closeMobileMenu}>Iniciar Sesión</Link>
                </div>
            </nav>

            <section className="luvan-hero" id="inicio">
                <div
                    className="luvan-hero-bg"
                    style={{ backgroundImage: "url('https://images.unsplash.com/photo-1634750007309-8c951d5a60e2?w=1900&q=80&auto=format&fit=crop')" }}
                />
                <div className="luvan-hero-ov" />
                <div className="luvan-wrap luvan-hero-inner">
                    <span className="luvan-eyebrow">Transporte escolar y empresarial · Guatemala</span>
                    <h1>Seguridad y confianza<br className="luvan-desktop-break" />en <span className="g">cada trayecto.</span></h1>
                    <p>Más de 10 años movilizando a estudiantes y colaboradores con unidades monitoreadas, personal capacitado y puntualidad garantizada.</p>
                    <div className="luvan-cta">
                        <a href="#contacto" className="luvan-btn luvan-btn-green">Contáctanos →</a>
                        <a href="#servicios" className="luvan-btn luvan-btn-ghost">Nuestros servicios</a>
                    </div>
                </div>
                <div className="luvan-scroll-cue"><span>Desliza</span><span className="bar" /></div>
            </section>

            <section className="luvan-stats">
                <div className="luvan-wrap luvan-stats-grid">
                    <div className="luvan-s luvan-reveal"><div className="luvan-v"><span className="luvan-num" data-to="10">0</span><span className="u">+</span></div><div className="luvan-l">Años de experiencia</div></div>
                    <div className="luvan-s luvan-reveal"><div className="luvan-v"><span className="luvan-num" data-to="50">0</span><span className="u">+</span></div><div className="luvan-l">Colegios y empresas</div></div>
                    <div className="luvan-s luvan-reveal"><div className="luvan-v"><span className="luvan-num" data-to="30">0</span><span className="u">+</span></div><div className="luvan-l">Unidades en flota</div></div>
                    <div className="luvan-s luvan-reveal"><div className="luvan-v"><span className="luvan-num" data-to="100">0</span><span className="u">%</span></div><div className="luvan-l">Compromiso y seguridad</div></div>
                </div>
            </section>

            <section className="luvan-band" id="porque">
                <div className="luvan-wrap">
                    <div className="luvan-head luvan-reveal">
                        <span className="luvan-eyebrow">¿Por qué elegirnos?</span>
                        <h2>La tranquilidad de viajar bien acompañado</h2>
                        <p>Cuidamos cada detalle para que cada viaje sea seguro, puntual y cómodo.</p>
                    </div>
                    <div className="luvan-cards3">
                        <div className="luvan-card luvan-reveal"><div className="luvan-ico"><ShieldIcon /></div><h3>Seguridad</h3><p>Vehículos equipados y procesos diseñados para proteger a cada pasajero, con monitoreo constante.</p></div>
                        <div className="luvan-card luvan-reveal"><div className="luvan-ico"><TimeIcon /></div><h3>Puntualidad</h3><p>Compromiso real con el cumplimiento de horarios en cada ruta y cada trayecto.</p></div>
                        <div className="luvan-card luvan-reveal"><div className="luvan-ico"><SupportIcon /></div><h3>Atención personalizada</h3><p>Adaptamos nuestros servicios a las necesidades específicas de cada colegio y empresa.</p></div>
                    </div>
                </div>
            </section>

            <section className="luvan-services luvan-band" id="servicios">
                <div className="luvan-wrap">
                    <div className="luvan-head luvan-reveal">
                        <span className="luvan-eyebrow">Nuestros servicios</span>
                        <h2>Soluciones de movilidad a tu medida</h2>
                        <p>Cubrimos las necesidades de transporte de instituciones, empresas y grupos.</p>
                    </div>
                    <div className="luvan-cards-svc">
                        <div className="luvan-svc luvan-reveal"><div className="luvan-ico"><BusIcon /></div><div><h3>Transporte Escolar</h3><p>Servicio seguro y confiable para estudiantes, con unidades monitoreadas y personal capacitado que da tranquilidad a padres y colegios.</p></div></div>
                        <div className="luvan-svc luvan-reveal"><div className="luvan-ico"><CorporateIcon /></div><div><h3>Transporte Corporativo y Empresarial</h3><p>Soluciones de movilidad eficientes para el traslado de colaboradores, optimizando rutas y tiempos para mejorar la productividad.</p></div></div>
                        <div className="luvan-svc luvan-reveal"><div className="luvan-ico"><CompassIcon /></div><div><h3>Excursiones</h3><p>Organizamos y coordinamos excursiones con cobertura a nivel nacional, asegurando comodidad y seguridad en cada viaje.</p></div></div>
                        <div className="luvan-svc luvan-reveal"><div className="luvan-ico"><CalendarIcon /></div><div><h3>Eventos Privados</h3><p>Transporte para eventos especiales: shuttles para actividades recreativas, fiestas, cumpleaños y más, con total comodidad.</p></div></div>
                    </div>
                </div>
            </section>

            <section className="luvan-band" id="nosotros">
                <div className="luvan-wrap luvan-about">
                    <div className="luvan-reveal">
                        <span className="luvan-eyebrow">Sobre nosotros</span>
                        <h2>Tu aliado estratégico en transporte</h2>
                        <p>Contamos con un equipo profesional y unidades de diversas capacidades para garantizar un servicio eficiente y confiable. Nos enorgullece ser el aliado de instituciones educativas y empresariales, superando expectativas en cada trayecto.</p>
                        <p className="luvan-quote">¡Confía en nosotros para la logística de transporte!</p>
                    </div>
                    <div className="luvan-panel luvan-reveal">
                        <img src={logoLuvan} alt="Transportes Luvan" />
                    </div>
                </div>
            </section>

            <section className="luvan-ctaband">
                <div className="luvan-wrap luvan-cta-inner">
                    <h2>¿Listos para coordinar tu transporte?</h2>
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20Transportes%20Luvan%2C%20quiero%20cotizar%20un%20servicio`} target="_blank" rel="noopener noreferrer" className="luvan-btn">Escríbenos por WhatsApp →</a>
                </div>
            </section>

            <section className="luvan-band" id="contacto">
                <div className="luvan-wrap luvan-contact">
                    <div className="luvan-reveal">
                        <h2>Contáctanos</h2>
                        <p className="luvan-sub">Cuéntanos qué necesitas y te damos una propuesta a tu medida.</p>
                        <div className="luvan-cinfo">
                            <div className="luvan-row"><div className="luvan-ic"><PhoneIcon /></div><div><div className="luvan-k">Teléfono</div><a className="luvan-val" href="tel:37481552">3748-1552</a></div></div>
                            <div className="luvan-row"><div className="luvan-ic"><EmailIcon /></div><div><div className="luvan-k">Correo</div><a className="luvan-val" href="mailto:administracion@transportesluvan.com">administracion@transportesluvan.com</a></div></div>
                            <div className="luvan-row"><div className="luvan-ic"><ClockIcon /></div><div><div className="luvan-k">Horario de atención</div><div className="luvan-val">Lunes a Viernes · 8:00 AM – 5:00 PM</div></div></div>
                            <div className="luvan-row"><div className="luvan-ic"><WhatsAppOutlineIcon /></div><div><div className="luvan-k">WhatsApp</div><a className="luvan-val" href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">Chatea con nosotros</a></div></div>
                        </div>
                    </div>

                    <form className="luvan-form luvan-reveal" onSubmit={handleContactSubmit}>
                        <div className="luvan-two">
                            <div className="luvan-field"><label htmlFor="contact-name">Nombre *</label><input id="contact-name" name="name" required placeholder="Tu nombre" /></div>
                            <div className="luvan-field"><label htmlFor="contact-email">Correo electrónico *</label><input id="contact-email" name="email" type="email" required placeholder="tucorreo@ejemplo.com" /></div>
                        </div>
                        <div className="luvan-field"><label htmlFor="contact-subject">Asunto *</label><input id="contact-subject" name="subject" required placeholder="¿En qué te ayudamos?" /></div>
                        <div className="luvan-field"><label htmlFor="contact-message">Mensaje *</label><textarea id="contact-message" name="message" required placeholder="Cuéntanos los detalles de tu solicitud" /></div>
                        <button type="submit" className="luvan-btn luvan-btn-green">Enviar mensaje por WhatsApp →</button>
                    </form>
                </div>
            </section>

            <footer className="luvan-footer">
                <div className="luvan-wrap">
                    <div className="luvan-fgrid">
                        <div>
                            <a href="#inicio" className="luvan-logo"><img src={logoLuvan} alt="Transportes Luvan" /></a>
                            <p className="luvan-fdesc">Soluciones de transporte seguras y confiables para colegios, empresas y eventos en Guatemala.</p>
                        </div>
                        <div className="luvan-col"><h4>Navegación</h4><a href="#inicio">Inicio</a><a href="#servicios">Servicios</a><a href="#nosotros">Sobre Nosotros</a><a href="#contacto">Contacto</a></div>
                        <div className="luvan-col"><h4>Servicios</h4><a href="#servicios">Transporte Escolar</a><a href="#servicios">Corporativo</a><a href="#servicios">Excursiones</a><a href="#servicios">Eventos Privados</a></div>
                        <div className="luvan-col"><h4>Contacto</h4><a href="tel:37481552">3748-1552</a><a href="mailto:administracion@transportesluvan.com">Correo</a><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">WhatsApp</a><p>Lun–Vie · 8AM–5PM</p></div>
                    </div>
                    <div className="luvan-fbase">
                        <span>© 2026 Transportes Luvan. Todos los derechos reservados.</span>
                        <span><Link to="/privacy-policy">Aviso de Privacidad</Link></span>
                    </div>
                </div>
            </footer>

            <a className="luvan-wa" href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20Transportes%20Luvan%2C%20necesito%20informaci%C3%B3n`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><WhatsAppIcon /></a>
        </main>
    );
};

export default LandingPage;
