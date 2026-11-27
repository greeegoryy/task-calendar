variable "project_id" {
  description = "GCP project that hosts the GKE cluster and backup resources."
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster used to scope the backup success log metric."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique Cloud Storage bucket for database backups."
  type        = string
}

variable "bucket_location" {
  description = "Cloud Storage location for database backups."
  type        = string
  default     = "EU"
}

variable "notification_channel_names" {
  description = "Existing Cloud Monitoring channel resource names for the freshness alert."
  type        = list(string)

  validation {
    condition     = length(var.notification_channel_names) > 0
    error_message = "Supply at least one existing Cloud Monitoring notification channel."
  }
}

variable "enable_freshness_alert" {
  description = "Enable notifications after confirming the first backup signal in the project."
  type        = bool
  default     = false
}
