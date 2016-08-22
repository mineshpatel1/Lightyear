#! /usr/bin/env python
# LYF data integration function library

import lyf, logging
import MySQLdb
import codecs
import re

from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

# MySQL database connection
def connect():
	mysql_user = lyf.get_config('MYSQL', 'Username')
	mysql_pw = lyf.get_config('MYSQL', 'Password')
	mysql_host = lyf.get_config('MYSQL', 'Hostname')
	mysql_db = lyf.get_config('MYSQL', 'Database')
	
	conn = MySQLdb.connect(host=mysql_host, user=mysql_user, passwd=mysql_pw, db=mysql_db, \
		charset='utf8', init_command='SET NAMES UTF8')
	return(conn)

# Insert row into table, updating on duplicate keys
def merge_into_table(db, table, row, keys):
	# UTF-8 encode all rows
	for col in row:
		if type(row[col]) is unicode:
			row[col] = row[col].encode('utf-8')
	
	sql = 'INSERT IGNORE INTO %s (\n' % table
	
	sql += ','.join(row.keys())
	sql += '\n) VALUES (\n'
	
	insert_values = []
	for col in row:
		insert_values.append("'%s'" % str(row[col]).replace("'","''"))
	sql += ','.join(insert_values)
	sql += ')'
	
	if (len(keys) != len(row)):
		sql += ' ON DUPLICATE KEY UPDATE \n'
	
		update_values = []
		for col in row:
			if (col not in keys):
				update = '%s=%s' % (col, "'%s'" % str(row[col]).replace("'","''"))
				update_values.append(update)
			
		sql += ','.join(update_values)
	sql += ';'
	
	db.query(sql)
	db.commit()

# Truncate table
def truncate(db, table):
	sql = 'TRUNCATE TABLE %s;' % table
	db.query(sql)
	
# Load Google Analytics dimension table
def load_ga_dim(full_mode, table, ga_dims, columns, keys):
	try:
		end_date = date.today().strftime('%Y-%m-%d') # Fetch up to today
		db = connect() # Connect to DB

		if full_mode:
			truncate(db, table) # Truncate table
			
			# Insert 0 row
			primary_key = re.search('d_ga_(.*?)$', table).group(1)
			primary_key += '_id'
			sql = 'INSERT INTO %s (%s) VALUES (-1);' % (table, primary_key)
			db.query(sql)
			db.commit()
			
			start_date = lyf.get_config('ETL', 'Extract_Date')
		else:
			start_date = end_date

		# Connect to Google Analytics
		service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
		metrics = 'ga:sessions'
		dims = ','.join(ga_dims)
		results = lyf.ga_query(service, start_date, end_date, metrics, dims)

		for row in results:
			rec = {}
			i = 0
			for key in columns:
				rec[key] = row[i]
				i += 1
			merge_into_table(db, table, rec, keys)

		db.close()

		if full_mode:
			mode = 'Full'
		else:
			mode = 'Incremental'
		logging.info('Successfully merged %s rows into %s (%s).' % (len(results), table, mode))
	except Exception as err:
		logging.error(err)