from app.blueprints.auth.routes import bp as auth_bp
from app.blueprints.boards.routes import bp as boards_bp
from app.blueprints.columns.routes import bp as columns_bp
from app.blueprints.cards.routes import bp as cards_bp
from app.blueprints.categories.routes import bp as categories_bp
from app.blueprints.comments.routes import bp as comments_bp
from app.blueprints.notifications.routes import bp as notifications_bp
from app.blueprints.analytics.routes import bp as analytics_bp
from app.blueprints.users.routes import bp as users_bp
from app.blueprints.shared.routes import bp as shared_bp
from app.blueprints.invites.routes import bp as invites_bp
from app.blueprints.health.routes import bp as health_bp

BLUEPRINTS = (
    auth_bp,
    boards_bp,
    columns_bp,
    cards_bp,
    categories_bp,
    comments_bp,
    notifications_bp,
    analytics_bp,
    users_bp,
    shared_bp,
    invites_bp,
    health_bp,
)


def register_blueprints(api):
    for bp in BLUEPRINTS:
        api.register_blueprint(bp, url_prefix="/api")
