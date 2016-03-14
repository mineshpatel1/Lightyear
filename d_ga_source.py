#!/usr/bin/python
# Google Analytics - Extract dimension - Source

import lyf, logging
import argparse
import codecs

from lyf import *
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

parser = argparse.ArgumentParser(description="Extract Dimension - d_ga_source")
parser.add_argument("-f", "--full", action='store_true', default=False, help="Specifies full mode for extract as opposed to incremental.")

args = parser.parse_args()
FULL_MODE = args.full

def print_results(results):
	# Print data nicely for the user.
	if results:
		print 'View (Profile): %s' % results.get('profileInfo').get('profileName')
		print 'Total Sessions: %s' % results.get('rows')[0][0]
		print 'Average Session Duration %s' % results.get('rows')[0][1]
	else:
		print 'No results found'

def main():
	try:
		db = sql.connect() # Connect to DB
		end_date = date.today().strftime('%Y-%m-%d')
	
		if FULL_MODE:
			sql.truncate(db, 'd_ga_source')
			start_date = lyf.get_config('ETL', 'Extract_Date')
		else:
			start_date = end_date
	
		# Connect to Google Analytics
		service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
		metrics = 'ga:sessions'
		dims = 'ga:source,ga:medium,ga:socialNetwork'
		results = lyf.ga_query(service, start_date, end_date, metrics, dims)
	
		# Check if there are rows
		if results.has_key('rows'):
			for row in results['rows']:
				rec = {}
				rec['source'] = row[0]
				rec['medium'] = row[1]
				rec['social_network'] = row[2]
				sql.merge_into_table(db, 'd_ga_source', rec, ['source', 'medium'])
	
		logging.info('Successfully loaded d_ga_source from %s to %s.' % (start_date, end_date))
	except Exception as err:
		logging.error(err)
	
if __name__ == '__main__':
	main()