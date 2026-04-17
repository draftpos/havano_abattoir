app_name = "havano_abattoir"
app_title = "Havano Abattoir"
app_publisher = "Ashley"
app_description = "Havano Abattoir App"
app_email = "makonia20@gmail.com"
app_license = "mit"

# Fixtures
# --------
# Export these DocTypes as fixtures (bundled with the app)
fixtures = [
    {
        "dt": "DocType",
        "filters": [["module", "=", "Havano Abattoir"]]
    },
    {
        "dt": "Workspace",
        "filters": [["module", "=", "Havano Abattoir"]]
    }
]

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "havano_abattoir",
# 		"logo": "/assets/havano_abattoir/logo.png",
# 		"title": "Havano Abattoir",
# 		"route": "/havano_abattoir",
# 		"has_permission": "havano_abattoir.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/havano_abattoir/css/havano_abattoir.css"
# app_include_js = "/assets/havano_abattoir/js/havano_abattoir.js"

# include js, css files in header of web template
# web_include_css = "/assets/havano_abattoir/css/havano_abattoir.css"
# web_include_js = "/assets/havano_abattoir/js/havano_abattoir.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "havano_abattoir/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "havano_abattoir/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "havano_abattoir.utils.jinja_methods",
# 	"filters": "havano_abattoir.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "havano_abattoir.install.before_install"
# after_install = "havano_abattoir.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "havano_abattoir.uninstall.before_uninstall"
# after_uninstall = "havano_abattoir.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "havano_abattoir.utils.before_app_install"
# after_app_install = "havano_abattoir.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "havano_abattoir.utils.before_app_uninstall"
# after_app_uninstall = "havano_abattoir.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "havano_abattoir.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"havano_abattoir.tasks.all"
# 	],
# 	"daily": [
# 		"havano_abattoir.tasks.daily"
# 	],
# 	"hourly": [
# 		"havano_abattoir.tasks.hourly"
# 	],
# 	"weekly": [
# 		"havano_abattoir.tasks.weekly"
# 	],
# 	"monthly": [
# 		"havano_abattoir.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "havano_abattoir.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "havano_abattoir.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "havano_abattoir.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["havano_abattoir.utils.before_request"]
# after_request = ["havano_abattoir.utils.after_request"]

# Job Events
# ----------
# before_job = ["havano_abattoir.utils.before_job"]
# after_job = ["havano_abattoir.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"havano_abattoir.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

