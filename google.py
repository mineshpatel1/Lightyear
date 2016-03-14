#!/usr/bin/python

# Extract data from Google Analytics

import lyf
import argparse
import httplib2

from apiclient.discovery import build
from oauth2client.service_account import ServiceAccountCredentials
from oauth2client import client, file, tools

def print_results(results):
	# Print data nicely for the user.
	if results:
		print 'View (Profile): %s' % results.get('profileInfo').get('profileName')
		print 'Total Sessions: %s' % results.get('rows')[0][0]
		print 'Average Session Duration %s' % results.get('rows')[0][1]
	else:
		print 'No results found'

def main():
	# Authenticate and construct service as read only
	service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
	results = lyf.ga_query(service, '2013-02-01', '2013-02-28', 'ga:sessions,ga:avgSessionDuration')
	print_results(results)

if __name__ == '__main__':
	main()