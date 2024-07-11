from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from .views import ImageUploadView

app_name = "walking_mode"

urlpatterns = [path("", ImageUploadView.as_view(), name="test")]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
