terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
}

data "google_project" "current" {
  project_id = var.project_id
}

locals {
  service_account = "dailyflow-postgres-backup"
  metric_name     = "dailyflow_postgres_backup_success"
  workload_pool   = "${var.project_id}.svc.id.goog"
  subject         = "ns/task-calendar/sa/${local.service_account}"
  backup_principal = join("", [
    "principal://iam.googleapis.com/projects/${data.google_project.current.number}",
    "/locations/global/workloadIdentityPools/${local.workload_pool}/subject/${local.subject}",
  ])
}

resource "google_storage_bucket" "backups" {
  name                        = var.bucket_name
  location                    = var.bucket_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age            = 30
      matches_prefix = ["postgres/"]
    }
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }
}

resource "google_storage_bucket_iam_member" "backup_writer" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectCreator"
  member = local.backup_principal
}

resource "google_logging_metric" "backup_success" {
  name        = local.metric_name
  description = "Confirmed uploads of DailyFlow PostgreSQL backups."
  filter      = <<-FILTER
    resource.type="k8s_container"
    resource.labels.project_id="${var.project_id}"
    resource.labels.cluster_name="${var.cluster_name}"
    resource.labels.namespace_name="task-calendar"
    resource.labels.container_name="backup"
    jsonPayload.event="${local.metric_name}"
  FILTER

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_monitoring_alert_policy" "stale_backup" {
  display_name          = "DailyFlow PostgreSQL backup is stale"
  combiner              = "OR"
  enabled               = var.enable_freshness_alert
  notification_channels = var.notification_channel_names

  lifecycle {
    precondition {
      condition     = !var.enable_freshness_alert || length(var.notification_channel_names) > 0
      error_message = "Supply at least one notification channel before enabling the freshness alert."
    }
  }

  documentation {
    mime_type = "text/markdown"
    content   = "No confirmed DailyFlow backup upload has been observed in 20 hours. Check the CronJob, last Job logs, and newest object in the backup bucket."
  }

  conditions {
    display_name = "No successful backup in 20 hours"

    condition_prometheus_query_language {
      query                     = <<-PROMQL
        absent_over_time({__name__="logging.googleapis.com/user/${google_logging_metric.backup_success.name}", monitored_resource="k8s_container", project_id="${var.project_id}"}[20h])
      PROMQL
      duration                  = "300s"
      evaluation_interval       = "60s"
      disable_metric_validation = !var.enable_freshness_alert
    }
  }
}

output "backup_bucket_name" {
  value = google_storage_bucket.backups.name
}

output "backup_writer_principal" {
  value = local.backup_principal
}
